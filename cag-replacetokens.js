const tl = require('azure-pipelines-task-lib');
const fs = require('fs');
const os = require('os');

try {
    var sourcePath = tl.getPathInput('sourcePath', true);
    var targetFilePattern = tl.getInput('targetFilePattern', true);
    const tokenRegex = tl.getInput('tokenRegex', true);
    const replaceTokens = tl.getInput('replaceTokenList', true);
    const replaceTokensArray = replaceTokens.replace(/\r\n/g, "\r").replace(/\n/g, "\r").split(/\r/);
    const throwExceptionifNotMapped = tl.getBoolInput('throwExceptionifNotMapped');
    
    var tokenDictionary = {};
    var tokenSetJsonSettingFiles = new Set;

    // clear leading and trailing quotes for paths with spaces
    sourcePath = sourcePath.replace(/"/g, "");

    // remove trailing slash
    if (sourcePath.endsWith("\\") || sourcePath.endsWith("/")) {
        sourcePath = sourcePath.substr(0, sourcePath.length - 1);
    }
        
    //check if source path exists
    tl.checkPath(sourcePath, "sourcePath");

    // store the tokens and values in dictionary 
    replaceTokensArray.forEach(token => {
        const idx = token.indexOf(':');
        const key = token.substr(0, idx);
        const value = token.substr(idx + 1);

        tokenDictionary[key] = value;
    });

    // create a glob removing any spurious quotes
    if (os.platform() !== "win32") {
        // replace \ with /
        targetFilePattern = targetFilePattern.replace(/\\/g, "/");
    }

    var files = tl.findMatch(sourcePath, targetFilePattern);
    if (!files || files.length === 0) {
        var msg = `Could not find files with glob [${targetFilePattern}].`;
        if (os.platform() !== "win32") {
            tl.warning("No files found for pattern. Non-windows file systems are case sensitvive, so check the case of your path and file patterns.");
        }
        tl.setResult(tl.TaskResult.Failed, msg);
    }

    var somethingNotMapped = false;
    
    for (var file of files) {
        const contents = fs.readFileSync(file).toString();
        const reg = new RegExp(tokenRegex, "g");
                
        var newContents = contents.replace(reg, (all,identifier) => {
            // add all tokens to a list, so we can finally check if the build task contains keys which doesn't exists in any file.
            tokenSetJsonSettingFiles.add(identifier);

            const token = tokenDictionary[identifier];
            if(token !== undefined) {
                if(/^\$\(\w+\)/.test(token)) {
                    tl.warning(`No variable found for token [${identifier}]. Or you should create the variable in any variable group/key vault, or remove this mapping.`);
                    somethingNotMapped = true;
                    return `__${identifier}__`;
                }

                console.log(`Replace token [${identifier}] with a value.`);
                return token;
            } 
            
            tl.warning(`Token [${identifier}] found in file, but not defined in build/release task. Please add a mapping for it.`);
            somethingNotMapped = true;
            return `__${identifier}__`;
        })

        fs.writeFileSync(file, newContents);
    }

    for(var key in tokenDictionary) {
        if(!tokenSetJsonSettingFiles.has(key)) {
            tl.warning(`Variable [${key}] doesn't exists in any file, please remove it from the build/release task`);
            somethingNotMapped = true;
        }
    }

    if(throwExceptionifNotMapped && somethingNotMapped) {
        tl.setResult(tl.TaskResult.Failed, "There are some errors, please check the other output comments.");
    }
} 
catch (error) {
    console.error(error);    
    tl.setResult(tl.TaskResult.Failed, error);
}

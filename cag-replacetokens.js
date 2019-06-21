const path = require('path');
const tl = require('azure-pipelines-task-lib');
const sh = require('shelljs');
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
        console.log(`Starting token replacement in [${file}]`);

        const contents = fs.readFileSync(file).toString();
        const reg = new RegExp(tokenRegex, "g");
                
        var newContents = contents.replace(reg, (all,identifier) => {
            //ADD ALL JSON TOKENS TO A LIST, SO WE CAN FINALLY CHECK IF BUILD TASK CONTAINS KEYS WHICH DOESN'T EXIST IN ANY FILE.
            tokenSetJsonSettingFiles.add(identifier);

            const token = tokenDictionary[identifier];
            if(token !== undefined) {
                if(/^\$\(\w+\)/.test(token)) {
                    somethingNotMapped = true;
            
                    tl.warning(`No variable found for token [${identifier}].`);
                    return `__${identifier}__`;
                }

                console.log(`Replace token [${identifier}] with secret value.`);
                return token;
            } 
            
            somethingNotMapped = true;

            tl.warning(`No secret found for token [${identifier}].`);
            return `__${identifier}__`;
        })

        //sh.chmod(666, file);
        fs.writeFileSync(file, newContents);
    }

    //CHECK IF THERE ARE TOKENS IN THE RELEASE PIPELINE, WHICH ARE NOT IN THE JSON FILES. 
    for(var key in tokenDictionary) {
        if(!tokenSetJsonSettingFiles.has(key)) {
            tl.warning(`Replace token property [${key}] doesn't exists in any json property file. Could be cleaned up!?`);
            somethingNotMapped = true;
        }
    }

    if(throwExceptionifNotMapped && somethingNotMapped) {
        tl.setResult(tl.TaskResult.Failed, "Not all tokens are replaced! Please check the replace token build/release task.");
    }
} 
catch (error) {
    console.error(error);    
    tl.setResult(tl.TaskResult.Failed, error);
}

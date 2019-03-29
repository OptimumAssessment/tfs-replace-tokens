# Replace Tokens Build/Release task
This build/release task can replace tokens with real values from variables, group variables and variables from any keyvault.

## Why this build/release task?
The build/release pipelines I found are pretty cool if tokens are completly unique over all you solutions. 
If tokens are not unique and you've just a couple of variable groups, than those tasks will not work.
Therefor you can use this build/release task where for example you can replace token **_unique-token_** with **value-a** in pipeline A, and with **value-b** in pipeline B.

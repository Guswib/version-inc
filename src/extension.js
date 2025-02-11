const vscode = require("vscode");
const fs = require("fs");
const path = require("path");
const { readFile } = require('fs/promises')
const { join } = require('path');

module.exports = {
    activate,
    deactivate,
};

const projectSettingsFileName ='version-inc.json';

let myStatusBarItem;
let myContext;
let globalSettingsPath;
let globalSettingsFile;
let projectSettingsPath;    //Path to projectSettingsile.
let projectSettingsFilePath;
let packageJsonFile;
let projectName;
let settings = vscode.workspace.getConfiguration("version-inc");
let promptStatusBarCommand = settings.get("statusBarPrompt");
let useDisplayNameStatusBar = settings.get("useDisplayName");
let glob_last_dateTime;
let glob_dateTime;

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                            ● Function Activate ●                             │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function activate(context) {
    console.log("activate version-inc");
    // • Activate - Initialize Extension • 
    //---------------------------------------------------------------------------------------------------------
    // "activationEvents" - "workspaceContains:package.json" in manifest ensures folder has a package.json file
    // so we can enable command pallette menu items
    vscode.commands.executeCommand('setContext', 'version-inc.workspaceHasPackageJSON', true);
    //---------------------------------------------------------------------------------------------------------
    globalSettingsPath = context.globalStoragePath;
    projectSettingsPath = vscode.workspace.workspaceFolders[0].uri.fsPath+ '\\' + '.vscode';
    packageJsonFile = join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'package.json');
    packageFile = await readFile(packageJsonFile);      // Read file into memory
    packageJson = JSON.parse(packageFile.toString());   // Parse json
    if (useDisplayNameStatusBar) {
        projectName = packageJson['displayName'];       // Get displayName value for status bar project name
    } else {
        projectName = packageJson['name'];              // Get name value for status bar project name
    }
    globalSettingsFile = globalSettingsPath + '\\' + 'version-inc-' + projectName + '.json';    // Files list json file
    globalExampleFileJS = globalSettingsPath + '\\' + 'example.js';                             // Example JS file
    globalExampleFileMD = globalSettingsPath + '\\' + 'example.md';                             // Example MD file
    projectSettingsFilePath = projectSettingsPath + '\\' + projectSettingsFileName;
    myContext = context;                    // Save context
    await initSettingsFilePath(context);    // Initialize settings and example files
    createStatusBarItem();                  // Create status bar item
    await initStatusBar();                  // Initialize status bar item
    myStatusBarItem.show();                 // Show status bar item

    // • Activate - Register Extension Commands • 
    vscode.commands.registerCommand('version-inc.version-inc', incVersion);
    vscode.commands.registerCommand('version-inc.version-dec', decVersion);
    vscode.commands.registerCommand('version-inc.edit-files-list', editFilesList);
    vscode.commands.registerCommand('version-inc.edit-example-files', editExampleFiles);
    vscode.commands.registerCommand('version-inc.version-pick', pickCommand);

    // • Activate - Push Subscriptions • 
    context.subscriptions.push(incVersion);
    context.subscriptions.push(decVersion);
    context.subscriptions.push(editFilesList);
    context.subscriptions.push(editExampleFiles);
    context.subscriptions.push(pickCommand);

    // • Activate - If user saved package.json update status bar button • 
    vscode.workspace.onDidSaveTextDocument((TextDocument) => {
        if (TextDocument.fileName === packageJsonFile) {
            initStatusBar();
        };
    }, null, context.subscriptions);

    const FileContentJson= await getProjectSettings();
    console.log("Project Settings loaded");
    if(FileContentJson!=""){
        glob_dateTime = FileContentJson['dateTime'];
        glob_last_dateTime = FileContentJson['last_dateTime'];
        console.log("Global variables set");
    }
    console.log("done activating\n\n");
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                          ● Function initStatusBar ●                          │
//  │                                                                              │
//  │                        • Initialize Status Bar Item •                        │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function initStatusBar() {
    const packageFile = await readFile(packageJsonFile);                        // Read file into memory
    const packageJson = JSON.parse(packageFile.toString());                     // Parse json
    const version = packageJson['version'];                                     // Get projects current version for status bar
    myStatusBarItem.text = '$(versions) ' + projectName + ' ' + 'v' + version   // Update status bar items text
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                       ● Function createStatusBarItem ●                       │
//  │                                                                              │
//  │                          • Create Status Bar Item •                          │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
function createStatusBarItem() {
    // • createStatusBarItem - If status bar item is undefined then create it • 
    if (myStatusBarItem === undefined) {
        myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 1); // Place on left side of status bar
        myStatusBarItem.command = 'version-inc.version-pick';       // Set command to version inc/dec picker command
        myStatusBarItem.tooltip = 'Update version of package.JSON, as well as other  files';    // Set tooltip text
    }
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                           ● Function pickCommand ●                           │
//  │                                                                              │
//  │                  • Prompt User for Version Update Method •                   │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function pickCommand() {

    // • pickCommand - Increment version if prompt is disabled • 
    if (!promptStatusBarCommand) {
        incVersion();
        return;
    }

    // • pickCommand - Prompt user for choice of inc/dec version • 
    let options = {
        placeHolder: "Increment or Decrement Version?",
        title: "---=== Version Inc - Select Version Update Task ===---"
    };
    const pick = await vscode.window.showQuickPick([{
            label: 'Increment',
            detail: `Increment Version`
        },
        {
            label: 'Decrement',
            detail: `Decrement Version`
        }
    ], options);

    // • pickCommand - User Canceled • 
    if (!pick) {
        return;
    }

    // • pickCommand - Perform Increment or Decrement • 
    if (pick.label === 'Increment') {
        incVersion();   // Increment version
    } else {
        decVersion();   // Decrement version
    }
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                           ● Function incVersion ●                            │
//  │                                                                              │
//  │                        • Increment Project Version •                         │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function incVersion() {
    // • incVersion - Verify package.json exists • 
    packagePath = join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'package.json');
    if (!fs.existsSync(packagePath)) {
        vscode.window.showWarningMessage('No package.json File Found!');
        return;
    };
    
    
    // • incVersion - Read package.json into memory • 
    const packageFile = await readFile(this.packagePath);
    const packageJson = JSON.parse(packageFile.toString());
    if (useDisplayNameStatusBar) {
        projectName = packageJson['displayName'];       // Get displayName value for status bar project name
    } else {
        projectName = packageJson['name'];              // Get name value for status bar project name
    };

    // • incVersion - Inititialize possible new version values • 
    const version = packageJson['version'];
    const versionArr = version.split('.').map(Number);
    const versions = {
        major: [versionArr[0] + 1, 0, 0].join('.'),
        minor: [versionArr[0], versionArr[1] + 1, 0].join('.'),
        patch: [versionArr[0], versionArr[1], versionArr[2] + 1].join('.')
    };

    // • incVersion - Increment Project Version • 
    let options = {
        placeHolder: "Increment Patch, Minor, or Major",
        title: "---=== Version Inc - Increment Version ===---"
    };
    const pick = await vscode.window.showQuickPick([{
            label: 'Patch',
            detail: `${version} → ${versions.patch}`
        },
        {
            label: 'Minor',
            detail: `${version} → ${versions.minor}`
        },
        {
            label: 'Major',
            detail: `${version} → ${versions.major}`
        }
    ], options);

    // • incVersion - Return if user cancelled • 
    if (!pick) {
        return;
    };

    // • incVersion - Choose new version • 
    const newVersion = versions[pick.label.toLowerCase()];
    
    // • incVersion - Notify user of new version • 
    vscode.window.showInformationMessage(`Version Bumped to ${newVersion}`);
    myStatusBarItem.text = '$(versions) ' + projectName + ' ' + 'v' + newVersion;

    glob_last_dateTime = glob_dateTime;
    glob_dateTime = getCurrentDateTime();
   
    // • incVersion - Store last version in the project settings file. •
    const SettingsContentJson =await updateProjectSettings(newVersion); //updates project SEttings
    // • incVersion - update the package.json • 
    await updateVersion_JSON(packagePath,newVersion);
     
    console.log('Date:\"' + glob_dateTime.year +'\" newDate: \"'+ glob_dateTime.year+'\"');
    await updateOtherJsonFiles(newVersion);

    await updateOtherTxtFiles(newVersion,glob_dateTime,version, glob_last_dateTime);
    await updateOtherFiles(newVersion);
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                           ● Function decVersion ●                            │
//  │                                                                              │
//  │                        • Decrement Project Version •                         │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function decVersion() {
    // • decVersion - Verify package.json exists • 
    packagePath = join(vscode.workspace.workspaceFolders[0].uri.fsPath, 'package.json');
    if (!fs.existsSync(packagePath)) {
        vscode.window.showWarningMessage('No package.json File Found!');
        return;
    }

    // • decVersion - Read package.json into memory • 
    const packageFile = await readFile(this.packagePath);
    const packageJson = JSON.parse(packageFile.toString());
    if (useDisplayNameStatusBar) {
        projectName = packageJson['displayName'];       // Get displayName value for status bar project name
    } else {
        projectName = packageJson['name'];              // Get name value for status bar project name
    }

    // • decVersion - Inititialize possible new version values • 
    const version = packageJson['version'];
    const versionArr = version.split('.').map(Number);
    const versionArrNew = version.split('.').map(Number);
    let canUpdateMajor;
    let canUpdateMinor;
    let canUpdatePatch;

    // • decVersion - Inform user if at v0.0.0 • 
    if (versionArr[0] == '0' && versionArr[1] == '0' && versionArr[2] == '0') {
        vscode.window.showWarningMessage('Cannot reduce version from v0.0.0');
        return;
    }

    // • decVersion - Decrease versions if possible • 
    if (versionArrNew[0] > 0) {
        versionArrNew[0]--;
        majorNew = [versionArrNew[0], versionArr[1], versionArr[2]].join('.'),
        canUpdateMajor = true;
    }
    if (versionArrNew[1] > 0) {
        versionArrNew[1]--;
        minorNew = [versionArr[0], versionArrNew[1], versionArr[2]].join('.'),
        canUpdateMinor = true;
    }
    if (versionArrNew[2] > 0) {
        versionArrNew[2]--;
        patchNew = [versionArr[0], versionArr[1], versionArrNew[2]].join('.'),
        canUpdatePatch = true;
    }

    // • decVersion - Define version strings for possible picks • 
    const versions = {
        major: [versionArrNew[0], versionArr[1], versionArr[2]].join('.'),
        minor: [versionArr[0], versionArrNew[1], versionArr[2]].join('.'),
        patch: [versionArr[0], versionArr[1], versionArrNew[2]].join('.')
    }

    // • decVersion - Create list of options • 
    let options = {
        placeHolder: "Decrement Patch, Minor, or Major",
        title: "---=== Version Inc - Decrement Version ===---"
    };

    // • decVersion - Define Pick List Items • 
    let pickItems = [];
    const pickPatch = {
        label: 'Patch',
        detail: `${version} → ${patchNew}`
    };
    const pickMinor = {
        label: 'Minor',
        detail: `${version} → ${minorNew}`
    };
    const pickMajor = {
        label: 'Major',
        detail: `${version} → ${majorNew}`
    };

    // • decVersion - Push valid pick items to the array • 
    if (canUpdatePatch) {
        pickItems.push(pickPatch);
    };
    if (canUpdateMinor) {
        pickItems.push(pickMinor);
    };
    if (canUpdateMajor) {
        pickItems.push(pickMajor);
    };

    // • decVersion - Wait for user to pick item • 
    const pick = await vscode.window.showQuickPick(pickItems, options);

    // • decVersion - Return if user cancelled • 
    if (!pick) {
        return;
    }

    // • decVersion - Choose new version • 
    const newVersion = versions[pick.label.toLowerCase()];
    // • decVersion - Replace original file version with new one • 
    packageJson.version = newVersion;
    // • decVersion - Update package.json with new version • 
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, '\t'));
    // • decVersion - Notify user of new version • 
    vscode.window.showInformationMessage(`Version Bumped to ${newVersion}`);
    myStatusBarItem.text = '$(versions) ' + projectName + ' ' + 'v' + newVersion;
    updateOtherFiles(newVersion);
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                            ● Function editFiles ●                            │
//  │                                                                              │
//  │                      • Edit Files in version-inc.json •                      │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function editFilesList() {
    initSettingsFilePath(myContext);
    var document = await vscode.workspace.openTextDocument(globalSettingsFile); // Open it for editing
    await vscode.window.showTextDocument(document);
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                        ● Function editExampleFiles ●                         │
//  │                                                                              │
//  │                      • Edit version-inc Example Files •                      │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function editExampleFiles() {
    initSettingsFilePath(myContext);
    const exampleMDFilePath = path.join(globalSettingsPath, 'example.md');
    const exampleJSFilePath = path.join(globalSettingsPath, 'example.js');
    var document1 = await vscode.workspace.openTextDocument(exampleMDFilePath); // Open it for editing
    var document2 = await vscode.workspace.openTextDocument(exampleJSFilePath); // Open it for editing
    await vscode.window.showTextDocument(document1);
    await vscode.window.showTextDocument(document2);
};


//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                        ● Function updateOtherJSONFiles ●                     │
//  │                                                                              │
//  │                 • Update Other JSON Files with the New Version •             │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function updateOtherJsonFiles(newVersion) {

    // • updateOther JSON Files - Load settings file into memory • 
    const projectSettingsFileContent = await readFile(projectSettingsFilePath);
    const projectSettingsJson = JSON.parse(projectSettingsFileContent.toString("utf-8"));
    const length = projectSettingsJson['json-files']['length'];
    const listOfjsonFiles= projectSettingsJson['json-files'];
    // • updateOther JSON Files - Loop through all files in the settings file • 
    for (let i = 0; i < length; i++) {
        var fileName = listOfjsonFiles[i]['Filename']; // File name
        var location = listOfjsonFiles[i]['FileLocation']; // File Location
        var targetFilePath= sub_2_filepath(location, fileName);         // Full path to target file
        var enable = listOfjsonFiles[i]['Enable'];                      // Enable replace flag
        // • updateOtherFiles - Retrieve the rest of the settings • 
        
        if (enable) {
            updateVersion_JSON(targetFilePath,newVersion);
        }
    }
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                        ● Function updateOtherTxtFiles ●                     │
//  │                                                                              │
//  │                 • Update Other JSON Files with the New Version •             │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function updateOtherTxtFiles(newVersion,newDate,last_version,last_dateTime) {

    // • updateOtherTxtFiles - Load settings file into memory • 
    const projectSettingsFileContent = await readFile(projectSettingsFilePath);
    const projectSettingsJson = JSON.parse(projectSettingsFileContent.toString("utf-8"));
    const length = projectSettingsJson['txt-files']['length'];
    const list_Of_other_Files= projectSettingsJson['txt-files'];
    
    // • Loop through all files in the settings file • 
    for (let i = 0; i < length; i++) {
        var fileName = list_Of_other_Files[i]['Filename']; // File name
        var location = list_Of_other_Files[i]['FileLocation']; // File Location
        var targetFilePath= sub_2_filepath(location, fileName);         // Full path to target file
        var enable = list_Of_other_Files[i]['Enable'];                      // Enable replace flag
        var patterns = list_Of_other_Files[i]['Patterns'];                      // Enable replace flag
        // • updateOtherFiles - Retrieve the rest of the settings • 
        
        if (enable) {
            updateVersion_txtFile(targetFilePath,patterns,newVersion,newDate,last_version,last_dateTime);
        }
    }
};


//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                        ● Function updateOtherFiles ●                         │
//  │                                                                              │
//  │                 • Update Other Files with the New Version •                  │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function updateOtherFiles(newVersion) {

    // • updateOtherFiles - Load settings file into memory • 
    const packageFile = await readFile(globalSettingsFile);
    const packageJson = JSON.parse(packageFile.toString("utf-8"));
    const length = packageJson['length'];

    // • updateOtherFiles - Loop through all files in the settings file • 
    for (let i = 0; i < length; i++) {
        var fileName = packageJson[i]['Filename']; // File name
        var location = packageJson[i]['FileLocation']; // File Location
        
        var targetFilePath= sub_2_filepath(location, fileName);         // Full path to target file


        // • updateOtherFiles - Retrieve the rest of the settings • 
        var enable = packageJson[i]['Enable'];                      // Enable replace flag
        var insBefore = packageJson[i]['InsertBefore'];             // String to insert before version string
        var insAfter = packageJson[i]['InsertAfter'];               // String to insert after version string
        var retainLine = packageJson[i]['RetainLine'];              // Retain version string macro line
        var trimTextStart = packageJson[i]['TrimTextStart'];        // Number of characters to trim from start of line
        var trimTextEnd = packageJson[i]['TrimTextEnd'];            // Number of characters to trim from end of line
        var newVersionString = insBefore + newVersion + insAfter;   // Final new version string

        // • updateOtherFiles - V-INC Version Number Regular Expression • 
        const vincRegex = /v-inc/gmi;

        // • updateOtherFiles - Time Regular Expressions • 
        // AM/PM Uppercase Regex
        const ampmuRegex = /\${AMPMU}/gmi;
        // AM/PM Lowercase Regex
        const ampmlRegex = /\${AMPML}/gmi;
        // 12 Hours Format Regex
        const h12Regex = /\${H12}/gmi;
        // 24 Hours Format Regex
        const h24Regex = /\${H24}/gmi;
        // Minutes Regex
        const minRegex = /\${MIN}/gmi;
        // Seconds Regex
        const secRegex = /\${SEC}/gmi;

        // • updateOtherFiles - Date Regular Expressions • 
        // Year Long Regex
        const yearLongRegex = /\${YEAR4}/gmi;
        // Year Short Regex
        const yearShortRegex = /\${YEAR2}/gmi;
        // Month Text Long Regex (Eg. January)
        const monthTextLongRegex = /\${MONTHTEXTL}/gmi;
        // Month Number Regex Text Short Regex (Eg. Jan)
        const monthTextShortRegex = /\${MONTHTEXTS}/gmi;
        // Month Number Regex Text Short Regex (Eg. Jan)
        const monthNumberRegex = /\${MONTHNUMBER}/gmi;
        // Date Regex
        const dateRegex = /\${DATE}/gmi;

        // • updateOtherFiles - Get date and time for associated macros • 
        var date = new Date();
        var [year, month, day] = [date.getFullYear(), date.getMonth()+1, date.getDate()];
        var [hours, minutes, seconds] = [date.getHours(), date.getMinutes(), date.getSeconds()];
        //hours = 12; // For testing hours, REMOVE when done
        //month = 12; // For testing months, REMOVE when done
        var h12 = hours;
        var h24 = hours;
        var ampmU = 'AM';
        var ampmL = 'am';
        if (hours > 11) {
            var ampmU = 'PM';
            var ampmL = 'pm';
        }
        if (hours > 12) {
            h12 = hours - 12;
            var ampmU = 'PM';
            var ampmL = 'pm';
        }
        if (hours == 0) {
            h12 = 12;
            var ampmU = 'AM';
            var ampmL = 'am';
        }

        // • updateOtherFiles - Convert to strings and add leading zero if needed • 
        var yearLongStr = year.toString();
        var yearShortStr = year.toString().slice(2,4);
        if (month == 1) {
            monthLongStr = 'January';
            monthShortStr = 'Jan';
        }
        if (month == 2) {
            monthLongStr = 'February';
            monthShortStr = 'Feb';
        }
        if (month == 3) {
            monthLongStr = 'March';
            monthShortStr = 'Mar';
        }
        if (month == 4) {
            monthLongStr = 'April';
            monthShortStr = 'Apr';
        }
        if (month == 5) {
            monthLongStr = 'May';
            monthShortStr = 'May';
        }
        if (month == 6) {
            monthLongStr = 'June';
            monthShortStr = 'Jun';
        }
        if (month == 7) {
            monthLongStr = 'July';
            monthShortStr = 'Jul';
        }
        if (month == 8) {
            monthLongStr = 'August';
            monthShortStr = 'Aug';
        }
        if (month == 9) {
            monthLongStr = 'September';
            monthShortStr = 'Sep';
        }
        if (month == 10) {
            monthLongStr = 'October';
            monthShortStr = 'Oct';
        }
        if (month == 11) {
            monthLongStr = 'November';
            monthShortStr = 'Nov';
        }
        if (month == 12) {
            monthLongStr = 'December';
            monthShortStr = 'Dec';
        }
        var monthNumberStr = month.toString().padStart(2, '0');
        var dateStr = day.toString().padStart(2, '0');
        var minStr = minutes.toString().padStart(2, '0');
        var secStr = seconds.toString().padStart(2, '0');
        var h12Str = h12.toString().padStart(2, '0');
        var h24Str = h24.toString().padStart(2, '0');

        // • updateOtherFiles - If this files update flag is enabled then process it • 
        if (enable) {
            var document = await vscode.workspace.openTextDocument(targetFilePath); // Open the file
            await vscode.window.showTextDocument(document);                     // Show the selected file
            const editor = vscode.window.activeTextEditor;

            for (let line = 0; line < document.lineCount; line++) {
                var { text } = document.lineAt(line);                   // Get line of text
                var vincMatched = text.match(vincRegex);                // Matching V-INC
                var ampmuMatched = text.match(ampmuRegex);              // Matching ${AMPMU}
                var ampmlMatched = text.match(ampmlRegex);              // Matching ${AMPML}
                var h12Matched = text.match(h12Regex);                  // Matching ${H12}
                var h24Matched = text.match(h24Regex);                  // Matching ${H24}
                var minMatched = text.match(minRegex);                  // Matching ${MIN}
                var secMatched = text.match(secRegex);                  // Matching ${SEC}
                var yearLongMatched = text.match(yearLongRegex);        // Matching ${YEAR4}
                var yearShortMatched = text.match(yearShortRegex);      // Matching ${YEAR2}
                var monthTextShortMatched = text.match(monthTextLongRegex); // Matching ${MONTHTEXTL}
                var monthTextLongMatched = text.match(monthTextShortRegex); // Matching ${MONTHTEXTS}
                var monthNumberMatched = text.match(monthNumberRegex);  // Matching ${MONTHNUMBER}
                var dateMatched = text.match(dateRegex);                // Matching ${DATE}
                var result = text;                                      // Results Buffer
                var dirtyFlag = false;                                  // Status Flag

                // • updateOtherFiles - Perform all string replacements on current line •  
                var result = result.replaceAll(vincRegex,newVersionString);
                var result = result.replaceAll(ampmuRegex, ampmU);
                var result = result.replaceAll(ampmlRegex, ampmL);
                var result = result.replaceAll(h12Regex, h12Str);
                var result = result.replaceAll(h24Regex, h24Str);
                var result = result.replaceAll(minRegex, minStr);
                var result = result.replaceAll(secRegex, secStr);
                var result = result.replaceAll(yearLongRegex, yearLongStr);
                var result = result.replaceAll(yearShortRegex, yearShortStr);
                var result = result.replaceAll(monthTextLongRegex, monthLongStr);
                var result = result.replaceAll(monthTextShortRegex, monthShortStr);
                var result = result.replaceAll(monthNumberRegex, monthNumberStr);
                var result = result.replaceAll(dateRegex, dateStr);

                if (minMatched) {
                    dirtyFlag = true;
                }

                if (secMatched) {
                    dirtyFlag = true;
                }

                if (h12Matched) {
                    dirtyFlag = true;
                }

                if (h24Matched) {
                    dirtyFlag = true;
                }

                if (ampmlMatched) {
                    dirtyFlag = true;
                }

                if (ampmuMatched) {
                    dirtyFlag = true;
                }

                if (yearLongMatched) {
                    dirtyFlag = true;
                }

                if (yearShortMatched) {
                    dirtyFlag = true;
                }

                if (monthTextShortMatched) {
                    dirtyFlag = true;
                }

                if (monthTextLongMatched) {
                    dirtyFlag = true;
                }

                if (monthNumberMatched) {
                    dirtyFlag = true;
                }

                if (dateMatched) {
                    dirtyFlag = true;
                }

                if (vincMatched) {
                    dirtyFlag = true;
                    if (trimTextStart > 0 || trimTextEnd > 0) {
                        result = result.substring(trimTextStart,result.length-trimTextEnd)
                    }
                    if (retainLine == true) {
                        result = text+'\n\n'+result;            // Save Macro Line for Reuse
                    }
                }

                // • updateOtherFiles - Now Replace Current Line in the File • 
                if (dirtyFlag) {
                    const currentLineLength = text.length;
                    await editor.edit(editBuilder => {
                        editBuilder.replace(new vscode.Range(line, 0, line, currentLineLength), result);
                    }).catch(err => console.log(err));
                    dirtyFlag = false;
                }
            }
        }
    }
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                      ● Function initSettingsFilePath ●                       │
//  │                                                                              │
//  │              • Global Storage Settings File for My Extension •               │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function initSettingsFilePath(context) {
    console.log('Create ini files');
    // • initSettingsFilePath - Default files list settings json file • 
    const defaultSettings = '[\n\t' +
                            '{\n\t\t' +
                            '\"Filename\": \"example.md\",\n\t\t' +
                            '\"FileLocation\": \"${globalStorage}\",\n\t\t' +
                            '\"Enable\": false,\n\t\t' +
                            '\"RetainLine\": true,\n\t\t' +
                            '\"InsertBefore\": \"\",\n\t\t' +
                            '\"InsertAfter\": \"\",\n\t\t' +
                            '\"TrimTextStart\": 5,\n\t\t' +
                            '\"TrimTextEnd\": 38\n\t' +
                            '},\n\t' +
                            '{\n\t\t' +
                            '\"Filename\": \"example.js\",\n\t\t' +
                            '\"FileLocation\": \"${globalStorage}\",\n\t\t' +
                            '\"Enable\": false,\n\t\t' +
                            '\"RetainLine\": false,\n\t\t' +
                            '\"InsertBefore\": \"v\",\n\t\t' +
                            '\"InsertAfter\": \"-Beta\",\n\t\t' +
                            '\"TrimTextStart\": 0,\n\t\t' +
                            '\"TrimTextEnd\": 0\n\t' +
                            '}\n' +
                            ']\n';
    // • initSettingsFilePath - example.md file • 
    const exampleMD = '# Version-Inc example in a markdown file\n\n' +
                      '## Change Log\n\n' +
                      '<!-- ## [v-inc] - ${YEAR4}-${MONTHNUMBER}-${DATE} Note: this Line will be preserved -->\n';
    // • initSettingsFilePath - example.js file • 
    const exampleJS = '//--------------------------------------------------\n' +
                      '// Version-Inc example in a java script file\n' +
                      '//--------------------------------------------------\n' +
                      '//\n' +
                      '// Last Modification: ${MONTHTEXTL} ${DATE} ${YEAR4}\n' +
                      '//                At: ${H12}:${MIN}:${SEC} ${AMPMU}\n' +
                      '//\n' +
                      '// File Version...: V-INC\n' +
                      '//\n' +
                      '// Product version: v-inc\n' +
                      '//--------------------------------------------------\n';
        // • initSettingsFilePath - Default files list settings json file • 
        console.log('Create project settings');
        let projectSettingsIni=""; 
        console.log('Create project settings1');
        projectSettingsIni=JSON.parse('{\"version\" : \"0.0.0\",\"dateTime\": { },\"last_version\": \"0.0.0\",\"last_dateTime\": { }, \"json-files\": [ ],\"txt-files\": [ ] }');
        console.error('Create project settings1');
        let exampleJSON1=JSON.parse('{\"Filename\": \"File1.json\",\"FileLocation\": \"${workspaceFolder}\",\"Enable\": true }');
        console.log('Create project settings2');
        let exampleJSON2=JSON.parse('{\"Filename\": \"File2.json\",\"FileLocation\": \"${workspaceFolder}\",\"Enable\": true }');
        console.log('Create project settings3');
        let exampleTxtFile1=JSON.parse('{\"Filename\": \"File1.ABC\",\"FileLocation\": \"${workspaceFolder}\",\"Enable\": true ,\"Patterns\": [\"Version v-inc\"] }' );
        let exampleTxtFile2=JSON.parse('{\"Filename\": \"File2.ABC\",\"FileLocation\": \"${workspaceFolder}\",\"Enable\": true ,\"Patterns\": [\"File Version...: V-INC\", \"Product version: v-inc\",\"Last Modification: ${MONTHTEXTL} ${DATE} ${YEAR4}\",\"     At: ${H12}:${MIN}:${SEC} ${AMPMU}\"] }' );
        
        projectSettingsIni['json-files']=[exampleJSON1, exampleJSON2];
        projectSettingsIni['txt-files']=[exampleTxtFile1, exampleTxtFile2];

    // • initSettingsFilePath - If global settingsfolder does not exist then create it • 
    if (!fs.existsSync(globalSettingsPath)) {
        fs.mkdirSync(globalSettingsPath, { recursive: true });
    }    
        // Write new settings file if it does not exist
    if (!fs.existsSync(globalSettingsFile)) {
        // Write new settings file if it does not exist
        fs.writeFileSync(globalSettingsFile, defaultSettings, 'utf8');
    }
    if (!fs.existsSync(globalExampleFileMD)) {
        // Write example.md file if it does not exist
        fs.writeFileSync(globalExampleFileMD, exampleMD, 'utf8');
    }
    if (!fs.existsSync(globalExampleFileJS)) {
        // Write example.js file if it does not exist
        fs.writeFileSync(globalExampleFileJS, exampleJS, 'utf8');
        }
    // • initSettingsFilePath - Create Global Storage Folder and Files • 
    
    const exampleMDFilePath = path.join(globalSettingsPath, 'example.md');
    const exampleJSFilePath = path.join(globalSettingsPath, 'example.js');
    fs.writeFileSync(exampleMDFilePath, exampleMD, 'utf8');
    fs.writeFileSync(exampleJSFilePath, exampleJS, 'utf8');

    // • initSettingsPath - Create project Storage Folder and File • 
    if (!fs.existsSync(projectSettingsPath)) {
        fs.mkdirSync(projectSettingsPath, { recursive: true });
    }
    if (!fs.existsSync(projectSettingsFilePath)) {
        console.log('Creat Project Settings file at ' + projectSettingsFilePath);

        fs.writeFileSync(projectSettingsFilePath, JSON.stringify(projectSettingsIni, null, '\t'));
        }
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                        ● Function updateProjectSettings ●                    │
//  │                                                                              │
//  │                 • Update Project Settings with the New Version •              │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function updateProjectSettings(newVersion) {
        // • incVersion - Verify that a project settings file exists • 
   
    const FileContentJson= await getProjectSettings();
    if(FileContentJson!=""){
        // • incVersion - Read the current version and saves the values to last_version • 
        FileContentJson.last_version = FileContentJson['version'];
        // • decVersion - Replace original file version with new one • 
        FileContentJson.version = newVersion;
        
        FileContentJson.last_dateTime = FileContentJson.dateTime;
        FileContentJson.dateTime = getCurrentDateTime();
    
        // • decVersion - Update package.json with new version • 
        fs.writeFileSync(projectSettingsFilePath, JSON.stringify(FileContentJson, null, '\t'));
        
    }
    return FileContentJson;
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                        ● Function updateProjectSettings ●                    │
//  │                                                                              │
//  │                 • Update Project Settings with the New Version •              │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function getProjectSettings() {
    // • incVersion - Verify that a project settings file exists • 
    
    if (!fs.existsSync(projectSettingsFilePath)) {
        vscode.window.showWarningMessage('No '+ projectSettingsFileName + ' file found in /.vcode!');
        return "";
    }else{
        const FileContent = await readFile(projectSettingsFilePath);
        const FileContentJson = JSON.parse(FileContent.toString("utf-8"));

        // • incVersion - Returns the file content • 
        return FileContentJson;
    }
};



//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                        ● Function updateVersion of Json file ●                 │
//  │                                                                              │
//  │                                 │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function updateVersion_JSON(JsonFilePath,newVersion) {
    // • incVersion - Verify JSON file exists • 
    
    if (!fs.existsSync(JsonFilePath)) {
        vscode.window.showWarningMessage('No '+JsonFilePath+ ' json File Found!');
        console.error('No file found at ' + JsonFilePath);
        return;
    }else{
        const JsonFile = await readFile(JsonFilePath);
        const contentJson = JSON.parse(JsonFile.toString("utf-8"));
        contentJson.version = newVersion;
        // • Update json with new version • 
        fs.writeFileSync(JsonFilePath, JSON.stringify(contentJson, null, '\t'));
    }
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                        ● Function updateVersion of text file ●                 │
//  │                                                                              │
//  │                                 │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
async function updateVersion_txtFile(FilePath,patterns,newVersion,new_dateTime,lastVersion,last_dateTime) {
    // • incVersion - Verify JSON file exists • 
    console.log('UpdateVersion_OtherFiles  ');
    if (!fs.existsSync(FilePath)) {
        vscode.window.showWarningMessage('No '+FilePath+ '  File Found!');
        console.log('No file found at ' + FilePath);
        return;
    };
    if(!patterns){
        console.log('No patterns found for ' + FilePath);
        return;
    }
    console.log('File found at ' + FilePath);
    console.log('LastVersion:\"' + lastVersion+'\" newVersion: \"'+ newVersion+'\"');
    console.log('Date:\"' + last_dateTime.year +'\" newDate: \"'+ new_dateTime.year+'\"');
            
    var rawFileContent = await readFile(FilePath);
    var txtFileContent = rawFileContent.toString();
    const length = patterns.length;


    // • updateOther Files - Loop through all files in the pattern • 
    for (let i = 0; i < length; i++) {
        let pattern = patterns[i];
        var lastVersionString=sub_regExpression(pattern,lastVersion,last_dateTime) ;   
        var newVersionString =sub_regExpression(pattern,newVersion,new_dateTime) ;  
    
    // • updateOtherFiles - Perform all string replacements on current line •  
        console.log('Replace:\"' + pattern+'\" with \"'+ newVersionString+'\"');
        var txtFileContent = txtFileContent.replace(pattern,newVersionString); //splaces all "v-inc"
        console.log('Replace:' + lastVersionString + ' with '+ newVersionString);
       var txtFileContent = txtFileContent.replace(lastVersionString, newVersionString);
    }
    //contentJson.version = newVersion;
    // • Update json with new version • 
    fs.writeFileSync(FilePath, txtFileContent);
};

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                           ● Function sub_2_filepath ●                        │
//  │                                                                              │
//  │                       • Creates a ful path to a file •                       │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
function sub_2_filepath(location, fileName) {
    let workspace = vscode.workspace.workspaceFolders[0].uri.fsPath;
    const workSpaceFolderRX = /\${workspaceFolder}/gmi;
    const globFolderRX = /\${globalStorage}/gmi;
    let locationRelative = true;
    let path =workspace;

    if(location.match(workSpaceFolderRX)) {
            locationRelative=false;
            path=location.replace(workSpaceFolderRX,workspace);
        }
    if(location.match(globFolderRX)) {
            locationRelative=false;
            path=location.replace(globFolderRX,myContext.globalStoragePath);
        }
    if (location == ""){
        locationRelative=false;
        path =workspace;
    }

    if(locationRelative){
        path = join(path, location);
    }
    let targetFilePath = join(path, fileName);                              // Full path to target file
    return targetFilePath;
}

//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                           ● Function sub_regExpression ●                        │
//  │                                                                              │
//  │                       • updates the pattern to remove the short codes •                       │
//  ╰──────────────────────────────────────────────────────────────────────────────╯

function sub_regExpression(pattern, version, date)
{
    const vincRegex = /v-inc/gmi; 
    const yearLongRegex = /\${YEAR4}/gmi;
    // Year Short Regex
    const yearShortRegex = /\${YEAR2}/gmi;
    // Month Number Regex Text Short Regex (Eg. Jan)
    const monthNumberRegex = /\${MONTHNUMBER}/gmi;
    const monthTextLongRegex=/\${MONTHTEXTL}/gmi;
    const monthTextShortRegex=/\${MONTHTEXTS}/gmi;
    // Day Regex
    const dayRegex = /\${DAY}/gmi;

    const ampmuRegex = /\${AMPMU}/gmi;
    // AM/PM Lowercase Regex
    const ampmlRegex = /\${AMPML}/gmi;
    // 12 Hours Format Regex
    const h12Regex = /\${H12}/gmi;
    // 24 Hours Format Regex
    const h24Regex = /\${H24}/gmi;
    // Minutes Regex
    const minRegex = /\${MIN}/gmi;
    // Seconds Regex
    const secRegex = /\${SEC}/gmi;
    
    //var vincMatched = pattern.match(vincRegex); 
    

    pattern=pattern.replaceAll(vincRegex,version);
    //year
    pattern=pattern.replaceAll(yearLongRegex,date.year.toString());
    pattern=pattern.replaceAll(yearShortRegex,date.year.toString().slice(2,4));
    //month command
    let months_str = monthNumber_2_str(date.month);
    pattern=pattern.replaceAll(monthNumberRegex,months_str.monthStr);
    pattern=pattern.replaceAll(monthTextLongRegex,months_str.monthLongStr);
    pattern=pattern.replaceAll(monthTextShortRegex,months_str.monthShortStr);
    //day
    pattern=pattern.replaceAll(dayRegex,date.day.toString().padStart(2, '0'));
    
    let hours_str = hours_2_str(date.hours);
    pattern=pattern.replaceAll(h24Regex,hours_str.h24);
    pattern=pattern.replaceAll(h12Regex,hours_str.h12);
    pattern=pattern.replaceAll(ampmlRegex,hours_str.ampmL);
    pattern=pattern.replaceAll(ampmuRegex,hours_str.ampmU);
    
    pattern=pattern.replaceAll(minRegex,date.minutes.toString().padStart(2, '0'));
    pattern=pattern.replaceAll(secRegex,date.seconds.toString().padStart(2, '0'));
    
    return pattern;
}


function getCurrentDateTime()
{
    var date = new Date();
    var [year, month, day] = [date.getFullYear(), date.getMonth()+1, date.getDate()];
    var [hours, minutes, seconds] = [date.getHours(), date.getMinutes(), date.getSeconds()];

    const dateTime_string = '{"year":'+year+', "month":'+ month +', "day":'+day+',"hours":'+hours+', "minutes":'+ minutes +', "seconds":'+seconds+'}';
    const dateTimeJSON = JSON.parse(dateTime_string);
    return dateTimeJSON;
}

function hours_2_str(hours,ampmU)
{
    var h12 = hours.toString().padStart(2, '0');
    var h24 = hours.toString().padStart(2, '0');
    var ampmU = 'AM';
    var ampmL = 'am';
    if (hours > 11) {
        var ampmU = 'PM';
        var ampmL = 'pm';
    }
    if (hours > 12) {
        h12 = hours - 12;
        var ampmU = 'PM';
        var ampmL = 'pm';
    }
    if (hours == 0) {
        h12 = 12;
        var ampmU = 'AM';
        var ampmL = 'am';
    }
    return {h24,h12,ampmU,ampmL};
}

function monthNumber_2_str(month)
{
    var monthStr = month.toString().padStart(2, '0');
    let monthLongStr="";
    let monthShortStr="";
    switch (month) {
        case 1:
            monthLongStr = 'January';
            monthShortStr = 'Jan';
            break;
        case 2:
            monthLongStr = 'February';
            monthShortStr = 'Feb';
            break;
        case 3:
            monthLongStr = 'March';
            monthShortStr = 'Mar';
            break;
        case 4:
            monthLongStr = 'March';
            monthShortStr = 'Mar';
            break;
        case 5:
            monthLongStr = 'May';
            monthShortStr = 'May';
            break;
        case 6:
            monthLongStr = 'June';
            monthShortStr = 'Jun';
            break;
        case 7:
            monthLongStr = 'July';
            monthShortStr = 'Jul';
            break;
        case 8:
            monthLongStr = 'August';
            monthShortStr = 'Aug';
            break;
        case 9:
            monthLongStr = 'September';
            monthShortStr = 'Sep';
            break;
        case 10:
            monthLongStr = 'October';
            monthShortStr = 'Oct';
            break;
        case 11:
            monthLongStr = 'November';
            monthShortStr = 'Nov';
            break;
        case 12:
            monthLongStr = 'December';
            monthShortStr = 'Dec';
        default:
            monthLongStr = 'Unknown';
            monthShortStr = 'Unknown';
            break;
    }
    return {monthStr, monthLongStr, monthShortStr};
};
//  ╭──────────────────────────────────────────────────────────────────────────────╮
//  │                           ● Function deactivate ●                            │
//  │                                                                              │
//  │                       • Deactivate Extension Cleanup •                       │
//  ╰──────────────────────────────────────────────────────────────────────────────╯
function deactivate() {}
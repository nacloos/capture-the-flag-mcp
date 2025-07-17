Create a web app in the ui/ folder (monorepo: client/ and server/).
The folder src contains a list of folders with web apps.
The goal of the ui is to easily run and visualize these web apps.

Left panel: 
* list with the apps in the src/ folder (minimal display, just folder names)
* click to select folder (rounded gray background)
* a run button (play icon) to run the app server, becomes stop button (square) when running
* a seamless menu bar
  *  centered at top of left panel
  * terminal icon: toggles console panel below main panel for unified process logs
  * delete icon: deletes selected folder (with inline confirmation)
* no border separating the menu bar from the list
* vscode-like folder tree experience (click outside to unselect)

Main panel:
* iframe connected to the selected app (localhost)
* console panel below iframe when opened (shows all process logs)
* no other ui in the main panel

Design:
* minimalistic design
* minimal click travel

Express backend server:
* watch src/ folder
* process management (start/stop servers with tree-kill)
* unified logging API
* uses src/runners.json for configuration
* folder deletion API (removes folder and updates runners.json)

Tech stack:
* react
* vite
* shadcn
  
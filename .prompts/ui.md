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
* console panel below iframe when opened with two tabs:
  * "Console" tab: shows all process logs
  * "Game Events" tab: shows structured application events via postMessage
  * seamless tab bar (no separator line below tabs)
  * tab styling: text-xs font with font-medium for inactive, font-semibold for active
  * active tab: bg-gray-200 with rounded corners
  * hover effect: bg-gray-100 for inactive tabs
  * auto-scrolls to bottom for new events
  * event formatting: monospace font, one line per event
  * color coding: blue for [folder], purple for EVENT_TYPE, gray for JSON data
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

Application event logging:
* apps can send structured events via postMessage to parent window
* event format: `{type: 'GAME_EVENT', event: {timestamp, eventType, data}}`
* real-time delivery from iframe to parent UI
* apps should throttle high-frequency events to prevent spam

Runners configuration:
* uses `npx http-server -c-1` to prevent browser caching issues

Tech stack:
* react
* vite
* shadcn
  
shadcn/ui
Docs
Components
Blocks
Charts
Themes
Colors
91.0k
Get Started

    Introduction
    Installation
    components.json
    Theming
    Dark Mode
    CLI
    Monorepo
    Open in v0
    JavaScript
    Blocks
    Figma
    Changelog
    Legacy Docs

Components

    Accordion
    Alert
    Alert Dialog
    Aspect Ratio
    Avatar
    Badge
    Breadcrumb
    Button
    Calendar
    Card
    Carousel
    Chart
    Checkbox
    Collapsible
    Combobox
    Command
    Context Menu
    Data Table
    Date Picker
    Dialog
    Drawer
    Dropdown Menu
    React Hook Form
    Hover Card
    Input
    Input OTP
    Label
    Menubar
    Navigation Menu
    Pagination
    Popover
    Progress
    Radio Group
    Resizable
    Scroll-area
    Select
    Separator
    Sheet
    Sidebar
    Skeleton
    Slider
    Sonner
    Switch
    Table
    Tabs
    Textarea
    Toast
    Toggle
    Toggle Group
    Tooltip
    Typography

Installation

    Next.js
    Vite
    Laravel
    React Router
    Remix
    Astro
    TanStack Start
    TanStack Router
    Manual Installation

Dark mode

    Dark Mode
    Next.js
    Vite
    Astro
    Remix

Registry

    Registry
    Getting Started
    FAQ
    Open in v0
    Examples
    registry.json
    registry-item.json

Vite
Previous
Next

Install and configure shadcn/ui for Vite.
Create project

Start by creating a new React project using vite. Select the React + TypeScript template:

npm create vite@latest

Add Tailwind CSS

npm install tailwindcss @tailwindcss/vite

Replace everything in src/index.css with the following:
src/index.css

@import "tailwindcss";

Edit tsconfig.json file

The current version of Vite splits TypeScript configuration into three files, two of which need to be edited. Add the baseUrl and paths properties to the compilerOptions section of the tsconfig.json and tsconfig.app.json files:
tsconfig.json

{
  "files": [],
  "references": [
    {
      "path": "./tsconfig.app.json"
    },
    {
      "path": "./tsconfig.node.json"
    }
  ],
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}

Edit tsconfig.app.json file

Add the following code to the tsconfig.app.json file to resolve paths, for your IDE:
tsconfig.app.json

{
  "compilerOptions": {
    // ...
    "baseUrl": ".",
    "paths": {
      "@/*": [
        "./src/*"
      ]
    }
    // ...
  }
}

Update vite.config.ts

Add the following code to the vite.config.ts so your app can resolve paths without error:

npm install -D @types/node

vite.config.ts

import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"
 
// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
})

Run the CLI

Run the shadcn init command to setup your project:

npx shadcn@latest init

You will be asked a few questions to configure components.json.

Which color would you like to use as base color? › Neutral

Add Components

You can now start adding components to your project.

npx shadcn@latest add button

The command above will add the Button component to your project. You can then import it like this:
src/App.tsx

import { Button } from "@/components/ui/button"
 
function App() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center">
      <Button>Click me</Button>
    </div>
  )
}
 
export default App

Next.js
Laravel

On This Page
Create project
Add Tailwind CSS
Edit tsconfig.json file
Edit tsconfig.app.json file
Update vite.config.ts
Run the CLI
Add Components
Deploy your shadcn/ui app on Vercel
Trusted by OpenAI, Sonos, Adobe, and more.
Vercel provides tools and infrastructure to deploy apps and features at scale.
Deploy to Vercel
Built by shadcn at Vercel. The source code is available on GitHub.

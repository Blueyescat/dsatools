Blueprint Editor is an app allowing to design DSA ships/blueprints with various features. It can work offline (see the [homepage](/) for details) and it supports touch screens.

This guide also acts as a list of features and it doesn't go into the details that you will encounter when using the app.

### Table of Contents
- [Tools](#Tools)
- [Blueprint String Window](#Blueprint+String+Window)
- [Object Selection System](#Object+Selection+System)
- [History System](#History+System)
- [Collaboration (Multi-user)](#Collaboration)
- [Transform (Rotate and Flip)](#Transform)
- [Find - Replace](#Find+-+Replace)
- [Load & Place Blueprint](#Load+&+Place)
- [Expando Box Tester](#Expando+Box+Tester)
- [Pusher Focuser](#Pusher+Focuser)
- [Export Image](#Export+Image)
- [Hotbar](#Hotbar)
- [Miscellaneous](#Miscellaneous)
  - [Other Keyboard Shortcuts](#Other+Keyboard+Shortcuts)

## Tools
### Select `(Q)`
- Left click to select an object. Click and hold to select multiple objects. Use `Ctrl` and `Shift` to add to selection, remove from selection, and invert selection.
- Double left click or single right click an object to configure it.
- Move selected objects by dragging them.
- Duplicate objects by dragging them while holding `Alt`.

### Place `(F)`
- Pick an item using the item slot in the toolbar (left bar). Use the config button under the slot to place a pre-configured object.
- Place or configure objects by left clicking.
- Hold `Shift` for line placement. Hold `Alt` for locked line angle.
- Right click to delete objects.
- Hold the shortcut key to quickly open the item picker.

### Eraser `(E)`
- Left click to delete objects (can be held).
- Right click to configure objects.

### Crop `(T)`
- Hold left click to select an area to crop. The box can be resized. This can also be used to enlarge the map.
- Only the outlined objects will be kept after cropping. A cyan box indicates the new map dimensions: it snaps to the grid, expands to fit the included objects, and shows the length of each edge.
- Press `Enter` or double click inside box to apply the crop. Press `ESC` or double click outside box to cancel it.

### Blueprint Export `(G)`
- Select an area to export as a blueprint, just like the Blueprint Scanner in the game.


## Blueprint String Window `(B)`
A window that displays a blueprint string (such as for the map or from the [export tool](#Blueprint+Export)), with various options to modify the blueprint and information about its contents.
- Sort blueprint commands by item type.
- Change build direction (up/down), with an option to reverse for specific item types.
- Exclude items not supported by RCD (for loading the blueprint in the editor later).
- List of conents, materials to craft, the RCD cost, resizing required for the starter ship, and some other information.

## Object Selection System
- Selected objects are outlined in blue.
- Delete selected objects by pressing `Delete` or via the `Edit` menu.
- Copy, paste or cut selected objects using `Ctrl+C/V/X` or the `Edit` menu.
- Duplicate objects by pressing `Ctrl+D` or via the `Edit` menu.

## History System
Undo/redo actions. `Ctrl+Z` to undo, `Ctrl+(Shift+Z / Y)` to redo. Also accessible via the `Edit` menu, or from the toolbar (left bar) on touch screens.

## Collaboration (Multi-user, Experimental)
Multi-user editing. Create a room and share ID/link to let others join you, or join others. Acces via the `More` menu.
  - Room ownership: Only the owner can load a new BP. The creator is the owner, but ownership may be transfered to another user if the owner disconnects.

## Transform (Rotate and Flip)
Rotate or flip selected objects or the map. Supports object configurations. Access via the `Edit/Map > Transform` menu.

## Find - Replace
Allows searching for objects with specific item types and configurations and replacing with one item type with partial configuration. Matching objects are indicated by a thick orange outline. Access by pressing `Ctrl+F/H` or via the `Edit` menu.

## Load & Place Blueprint
Load a blueprint and place it as selected objects. Access via the `File` menu, or press `Ctrl+Shift+V` while you have a blueprint string in your clipboard.

## Expando Box Tester
Allows simulating the expansion of an expando box and calculating its capacity. The capacity calculation isn't well tested but seems to be pretty precise and can be off by 1 in some cases. It shows a blue box for the expansion area.
- The expansion may stop unexpectedly in some cases. You can move the box a little to fix it.

## Pusher Focuser
Allows focusing multiple pushers at a specific location with a beam length option. Access via the `More` menu.

## Export Image
Export the current blueprint/map as an image, with many options. Access via the `File` menu.

## Hotbar
- Left click or `0-9` keys: Select a slot, which changes the item used to place objects.
- Right click, `Ctrl+[0-9]` keys, double click or long touch: Change a slot.

## Miscellaneous
- Most windows in the app are draggable. They will remember the position. Click and hold their title bar to drag , double click to reset position.
- Invalid objects shown in red are excluded from blueprint outputs. Such as overlapping objects and objects without a support block underneath.
- Leaving the page while there is anything in the undo/redo history will display the browser's confirmation dialog. The BP is automatically saved to recent maps but the history is not.
- The `List of Items & Materials` window displays list of contents and BoM for the current map or the export tool. Can be opened from the `View` menu for the map, or from the [Blueprint String Window](#Blueprint+String+Window).
- `/bpeditor?load=<bp-string>` can be used to load the BP string from the URL.
- Changelog is in the `More` menu.

### Other Keyboard Shortcuts
- `Ctrl+S`: Copy blueprint string for the current map.
- `N`: New Blueprint window
- `B`: Blueprint String window
- `WASD/Arrows Keys`: Drag the map.
- `C`: Reset map zoom.
- `Ctrl+C/V`: Copy or paste the configuration of the object being hovered over. Note: It may conflict with copying and pasting objects.
- Hold <code class="slashkey"></code>: Show FPS, tile coordinates and some debug information.

#### Known Issues
- Wall placement is wrong in some cases when loading blueprints.
- Rapidly placing blocks around each other may result in incorrect border textures.
- Collaboration doesn't support line placement.

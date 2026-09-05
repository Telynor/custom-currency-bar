# Custom Currency Bar

A Foundry VTT v14 module for D&D 5e that adds configurable currencies with custom icons to character and NPC sheets.

## Features

- Drag a world or compendium Item into the configuration to use its inventory quantity as currency.
- Create standalone currencies stored independently on every Actor.
- Choose an image through Foundry's file picker for either kind of currency.
- Display custom currencies directly alongside the standard platinum, gold, electrum, silver, and copper fields.
- Edit currency amounts directly from the Actor sheet.
- When an item-backed currency is set above zero on an Actor who does not own it, the source Item is copied into that Actor's inventory.
- Reorder and remove configured currencies.

## Installation

Extract the `custom-currency-bar` folder into Foundry's `Data/modules` folder, restart Foundry, and enable **Custom Currency Bar** in Manage Modules.

## Configuration

As a GM, open **Game Settings → Configure Settings → Module Settings → Custom Currencies**.

1. Click **Add Currency**.
2. Enter a name and choose an image for a standalone currency, or drag an Item onto the currency row.
3. Optionally replace the dragged Item's image using the file picker.
4. Save, then reopen any character sheet.

## Compatibility

Designed for Foundry VTT v14 and the official D&D 5e system. It uses a defensive sheet insertion strategy so it can work with the official sheet and many alternate sheets, but sheets that completely replace the inventory/wealth markup may require a compatibility adapter.

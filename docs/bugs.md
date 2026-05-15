# Known Bugs

## Step 8 — Rich Text Editor

### Shift+Tab outdent not working in bullet lists
**Page type:** `page`  
**Steps to reproduce:** Create a bullet list, indent an item with Tab, then press Shift+Tab to outdent.  
**Expected:** Item outdents one level.  
**Actual:** Nothing happens — Shift+Tab does not trigger the outdent handler.  
**Likely cause:** `_onKeydown` checks `e.key === 'Tab'` but Shift+Tab may be intercepted by the browser before the event fires, or the `e.shiftKey` flag is not being read correctly in that branch. Needs investigation.

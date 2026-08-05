<!--
   RETIRED — grid drag-and-drop.

   This part moved plantings between squares: press and hold to lift a tile,
   drop it on another and the two swapped, refuse the drop if nothing nearby
   had room. All of it assumed a lattice.

   The canvas replaced the lattice, and with it the whole idea of a drop being
   refused. A plant now goes exactly where the finger let go, clamped only by
   the outline of the bed, because overlapping leaves are a real thing to draw
   rather than an error to prevent. What used to be a refusal is a warning you
   see while the plant is still in your hand — see p8n_canvasdrag.js.

   Everything worth keeping was rewritten:
     liftStart / bindGrid        -> CanvasDrag.moveStart, CanvasDrag.bind
     planMove / nearestDrop      -> CanvasDrag.settle, Geom.clampInto
     hits / inBounds             -> Geom.inside, Garden.openSpot
     copyPlanting / pasteAt      -> p8l_canvas.js, in inches
     duplicate / freeSpot        -> Garden.duplicate, Garden.openSpot

   The file is kept only because the sandbox this project is edited from
   cannot delete inside the OneDrive folder. It is not in ORDER.txt and is
   not built. Delete it whenever you are at the machine.
-->

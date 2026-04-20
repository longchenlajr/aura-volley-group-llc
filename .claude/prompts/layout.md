Claude Code Prompt — Distributed Illustration System
Here's the prompt once you have the assets:

I'm replacing the single hero image approach with a distributed illustrated asset system. Decorative elements live throughout the page, not just the hero, creating an integrated editorial composition.
Assets available at public/longvolleyball/assets/:

dragon-head.png — standalone dragon head, transparent bg
dragon-coil.png — dragon body coil, transparent bg
volleyball.png — isolated volleyball, transparent bg
cloud-1.png, cloud-2.png, cloud-3.png — stylized clouds, transparent bg
blossom-branch.png — cherry blossom branch, transparent bg
blossom-single.png — single blossom, transparent bg
corner-flourish.png — ornate corner decoration, transparent bg
divider.png — horizontal ornamental divider, transparent bg

Remove the current full-image hero background. Replace with a distributed composition.

1. Hero redesign — layered composition
Hero section in src/app/(tournament)/longvolleyball/page.tsx:
Structure (desktop):

Hero is a single full-width section, min-height: 620px, position: relative, parchment background
Inside the hero, text content is in .lv-container, left-aligned, vertically centered, max-width 500px, positioned via CSS grid or flex
Decorative elements positioned absolutely around the text:

dragon-head.png — positioned top-right, 420px wide, slight translate down and right so it crops at the edge. Subtle hover animation: slow 4s ease-in-out rotate between -1deg and 1deg, continuous
cloud-1.png — far left, top 20%, 200px wide, 40% opacity
cloud-2.png — bottom center, 280px wide, 25% opacity
blossom-branch.png — top-left corner, 180px wide, rotated slightly so it extends inward
corner-flourish.png — one in each corner of the hero, 80px wide, 60% opacity, each rotated appropriately (top-left as-is, top-right flipped horizontally, bottom corners flipped vertically and/or horizontally)


Text content sits naturally in the composed space, with all decorative elements behind it (use z-index: 1 on text and z-index: 0 on decorations)

Mobile layout:

Hero stacks vertically
Dragon head displays as a centered block at top of hero, 240px wide
Cloud motifs and blossom branch hidden on mobile (reduce visual noise on small screens)
Corner flourishes become smaller (40px) and only appear in top-left and top-right of the hero
Text content centered below the dragon


2. Distributed page decorations
Beyond the hero, integrate assets throughout the page:
"Pick your date" section heading:

Place a small blossom-single.png (32px wide) inline to the left of the "UPCOMING TOURNAMENTS" tracked label, vertically aligned
Behind the "Pick your date" heading, position cloud-3.png absolutely at 12% opacity, offset to the right, rotated slightly — creates ambient texture behind the heading

Date selector:

No decorative elements on individual pills — keep them clean and functional
However, add a tiny blossom-single.png at 20px, 40% opacity, positioned to the far left of the row as a decorative bookend

Tournament detail card (the dark card showing selected tournament):

Add a small corner-flourish.png (50px, gold tinted, 30% opacity) in the top-left and bottom-right corners of this card — gives it the feel of a framed certificate

"A family tradition" section:

Full-bleed warmer parchment background (already exists)
Add dragon-coil.png absolutely positioned on the right side, 320px wide, 15% opacity, extending beyond the right edge of the container so it feels like the dragon wraps around the page
Add cloud-2.png at 20% opacity behind the section heading on the left

Between major sections:

Replace the current <SectionDivider /> SVG with divider.png (or keep the SVG and use the image on two key transitions — your call). Width 280px, centered

Footer:

blossom-single.png replaces the current centered decorative element in the footer middle, 32px wide


3. Implementation approach
Create a new component src/app/(tournament)/DecorativeAsset.tsx:
tsxinterface DecorativeAssetProps {
  src: string;
  alt?: string;
  className?: string;
  style?: React.CSSProperties;
}

export function DecorativeAsset({ src, alt = "", className, style }: DecorativeAssetProps) {
  return (
    <img
      src={`/longvolleyball/assets/${src}`}
      alt={alt}
      aria-hidden="true"
      className={className}
      style={{ pointerEvents: "none", userSelect: "none", ...style }}
    />
  );
}
Use this component everywhere decorative assets appear. Consistent, accessible (aria-hidden), and non-interactive.
For performance:

All decorative images lazy-load except those in the hero (which should preload)
Use Next.js <Image> for the hero dragon specifically to enable optimization
All other assets can use plain <img> since they're small and below-the-fold


4. Accessibility
All decorative images are aria-hidden="true" with empty alt text. Text content is fully readable without any of the images loading.

5. Centering check
Maintain the existing .lv-container pattern. Decorative elements positioned absolutely within sections should not affect the container's content flow — they sit outside the content layer.
Verify the hero content text (headings, subhead, button, divider rule) is centered vertically within the hero and left-aligned horizontally within .lv-container.

6. Remove
Delete public/longvolleyball/hero.png (or keep as backup) and remove its reference from the codebase.

Do not build yet. First confirm:

All 10 asset files exist at public/longvolleyball/assets/ — if any are missing, stop and tell me which
Your plan for z-index layering so decorative elements never block interactive elements (buttons, links)
How you'll handle mobile — which specific assets you'll hide vs scale down vs reposition
Any concerns about cumulative image weight affecting page load performance
The SVG hero illustration is being replaced with a generated image file. I've saved it to public/longvolleyball/hero.jpg.

1. Replace hero illustration
Delete src/app/(tournament)/hero-illustration.tsx entirely. Remove all imports.
Rebuild the hero section in src/app/(tournament)/longvolleyball/page.tsx:
The hero image is a landscape composition where the dragon and volleyball occupy the right side, with open parchment space on the left. Use this to your advantage — overlay the text content on the left side of the image rather than placing the image beside the text.
Desktop layout (≥1024px):

Hero is a single full-bleed section, height: 560px
Background: the hero image (public/longvolleyball/hero.jpg) set as background-image, with background-size: cover, background-position: center right, background-repeat: no-repeat
Fallback background color: var(--lv-bg-parchment) to prevent flash while image loads
Text content positioned on the left, centered vertically:

Constrained inside .lv-container
Left-aligned
Max-width 440px
Tracked label "2026 Tournament Series" in crimson
Display heading "The Long's Grass Volleyball" in Fraunces 900, ink color
Subheading "A family tournament series in Allentown, PA." in ink-muted
Primary CTA "Register for a tournament"


Add a very subtle left-to-right gradient overlay on the hero to ensure text legibility: linear-gradient(to right, rgba(245, 230, 200, 0.95) 0%, rgba(245, 230, 200, 0.7) 30%, transparent 55%) — this keeps the left side readable while preserving the dragon's visibility on the right

Tablet (768–1023px):

Hero height reduces to 480px
Same background image treatment but shifted: background-position: 75% center
Gradient overlay strengthens on the left for readability
Text content max-width 380px

Mobile (<768px):

Hero becomes a stacked layout — no background image overlay
Instead, the image displays as an <img> above the text content, full-width, max-height 280px, object-fit: cover, object-position: center
Text content below, centered, max-width 100%, text-align left
Hero section height: auto

Use Next.js <Image> component for the mobile <img> version for optimization. For the desktop CSS background, use a regular CSS background-image.

2. Fix centering across the entire page
Current layout has inconsistent horizontal alignment across sections. Normalize:
Create a single .lv-container utility class in src/app/(tournament)/tournament.css:
css.lv-container {
  max-width: 1200px;
  margin-left: auto;
  margin-right: auto;
  padding-left: clamp(1rem, 4vw, 2.5rem);
  padding-right: clamp(1rem, 4vw, 2.5rem);
  width: 100%;
  box-sizing: border-box;
}
Apply .lv-container to:

The header bar's interior flex container (monogram, center text, register link must all align with page content below)
The hero section's text overlay wrapper
The tournament list section wrapper
The date selector row
The tournament detail card wrapper
The "A family tradition" section wrapper
The footer's interior flex container

Specific issues to fix:

<SectionDivider /> components must be display: block; margin-left: auto; margin-right: auto so they center on the page regardless of parent width
Remove any padding-left values that don't have a matching padding-right
The "Pick your date" section currently drifts slightly left — it needs to inherit the same container constraints as the footer and hero
Footer copyright on the right and monogram on the left must hit the same horizontal bounds as the page content


3. Tournament list date selector polish
The current date pills in the "Pick your date" selector are functional but could be tighter. Minor refinement:

Active date pill: crimson background, parchment text — keep as is, this is good
Inactive date pills: parchment-white background, ink text, 1px ink-muted border at 20% opacity
On hover (inactive): border deepens to crimson at 30% opacity, 1.02 scale transform, 160ms ease
Date pill grid: allow wrapping on narrower viewports. At ≥768px, wrap at 5 per row max (currently all 9 force into one row which feels cramped)


4. Cleanup

Delete hero-illustration.tsx
Remove any now-orphaned imports or unused ornament components referenced only in the old hero
Keep all reusable ornaments: <Monogram />, <CornerFlourish />, <Blossom />, <SectionDivider />, <CloudMotif />, <Checkmark />, <ArrowRight />, <ChevronDown />, season icons


5. Verify

npm run build passes
Hero image loads and displays correctly at 375px, 768px, 1024px, 1280px, 1440px, 1920px viewport widths
Text on the hero remains readable at all breakpoints — the gradient overlay must never let the dragon compete with the heading
All page sections share identical horizontal bounds — no visual drift
The .lv-container pattern is consistent across header, all sections, and footer


Do not build yet. First confirm:

The image file exists at public/longvolleyball/hero.jpg. If it doesn't, stop and tell me.
Any other page sections that currently have inconsistent horizontal padding I didn't explicitly call out
Whether using CSS background-image vs Next.js <Image> for the desktop hero will cause any LCP (Largest Contentful Paint) performance issues — if yes, propose an alternative using <Image> with absolute positioning for text overlay


You're absolutely right to flip this. Outdoor readability completely changes the calculus — glare on a phone screen eats dark-mode contrast alive. Your instinct is correct.
Here's my honest read on what's happening and what to change:
What's working

The Fraunces display type is genuinely beautiful — "Pick your date" and "The Long's Grass Volleyball" have the right voice
The monogram, divider ornament, and blossom marks hit the flyer aesthetic
The layout discipline is good — generous whitespace, clear hierarchy, no clutter
The tournament card structure is solid (date pill, name, tags, meta, button)

What needs to change

Invert to a parchment base. The flyer itself is parchment with crimson and gold — that's the actual reference, and it's what carries into sunlight. Dark mode was a wrong turn. Make --lv-bg-parchment (#F5E6C8) the primary page background, --lv-ink (#2A1810) the primary text color, and use crimson/gold as accents on top. Dark backgrounds become the exception, not the rule (maybe for the hero section only, or removed entirely).
The hero is too empty. That huge blank space between the top of the page and the title is a desktop problem — viewport-height hero with a small amount of content centered in it creates dead space. Either fill it (with the dragon illustration, an ornamental pattern, a photo of the park) or collapse it so the tournament list is visible above the fold.
"Lehigh Valley, PA" is wrong. Your tournaments are at Hamilton Park Playlot, Allentown. Fix the config data.
Tags are illegible. "doubles" and "Registration open" pills in the current dark mode are low-contrast and the color coding isn't intuitive. In parchment mode: format tags get a crimson border with crimson text on parchment, status tags get a solid green fill for open / gray fill for closed.
Admin dashboard is too sparse. Nothing to look at until teams register. Needs an empty state with a decorative ornament and a clear "share your registration link" callout so day-one feels intentional.
Form inputs (add team modal) are nearly invisible. Same dark-on-dark contrast problem. Parchment flip solves this too.
Footer blossom and monogram row feel orphaned. With a parchment base these marks become much more legible and can sit proudly centered.


Reply to Claude Code with this:

Significant direction change. The dark-mode direction is wrong — users will be on phones outdoors in sunlight, where dark backgrounds become unreadable. Flip the entire tournament and admin surface to a parchment-based light theme matching the original flyer aesthetic.
Palette inversion:

Primary page background: --lv-bg-parchment (#F5E6C8) — this is now the default
Primary text: --lv-ink (#2A1810)
Secondary text: --lv-ink-muted (#6B4E3D)
Elevated surfaces (cards, modals): #FFF8E7 (slightly brighter parchment)
Primary action color: --lv-red (#7A1C1C) stays the same — crimson on parchment is exactly the flyer
Accent: --lv-gold (#9B6B1E, slightly deeper than before for better contrast on parchment — #C9922A is too light on a cream background)
Borders: rgba(122, 28, 28, 0.18) (subtle crimson) as the default, rgba(155, 107, 30, 0.35) (gold) for emphasis
Dark backgrounds (--lv-bg, --lv-bg-elevated) are preserved in tokens but used only as deliberate accent surfaces — e.g. the header bar, the tournament card date pills, or a single dark "about" band. Not the default canvas.

Specific fixes:

Tournament landing hero: reduce from full-viewport-height to ~480px tall. The tournament cards must be visible without scrolling on a 1280px viewport. Remove the dead space.
Header bar: keep the dark crimson-black as a deliberate accent band (72px tall) on top of the parchment page — like a flyer banner. Gold monogram and gold text on that dark band reads beautifully and carries the flyer vibe.
Tournament cards on parchment: #FFF8E7 background, 1px crimson border at 20% opacity, crimson date pill, crimson format tag, green "registration open" tag. Card hover: border deepens to crimson 45% opacity and gains a soft shadow.
Buttons: primary crimson button stays red — works on both parchment and dark. Secondary button becomes crimson outline on parchment (not gold outline). Ghost button uses --lv-ink-muted text.
Form inputs: parchment-tinted white background (#FFFDF6), 1px ink-muted border at 25% opacity, crimson focus ring at 15% opacity, ink-colored text.
Admin dashboard empty state: centered layout with the divider ornament, ink-muted "No teams registered yet" text, then a subtle card showing the public registration URL with a "Copy link" button — gives admin something actionable on day one.
Update tournaments.json location field from "Lehigh Valley, PA" to "Hamilton Park Playlot, Allentown PA" on all entries.
Footer centers the b/uilossom ornament prominently, with monogram left and copyright right, all on parchment.

Hero fill: Instead of an empty hero, add a subtle decorative pattern — repeating thin crimson ornamental corner flourishes at 8% opacity forming a light frame around the hero content, echoing the flyer's border treatment. No photos, no dragon illustrations yet — just ornamental line art at low opacity.
Verify before building: Confirm the parchment base won't require rewriting every component's color logic from scratch, and that semantic tokens (success green, error red) still work on parchment.


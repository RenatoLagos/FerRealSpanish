# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FerRealSpanish is a Spanish language learning platform built with Astro 5, featuring online class booking, contact forms, and automated email reminders. The site is deployed on Vercel with server-side rendering enabled.

## Development Commands

```bash
# Install dependencies
pnpm install

# Start development server at localhost:4321
pnpm dev

# Build for production (outputs to ./dist/)
pnpm build

# Preview production build locally
pnpm preview

# Run Astro CLI commands
pnpm astro ...
```

## Technology Stack

- **Framework**: Astro 5 (server-side rendering mode)
- **Styling**: Tailwind CSS with custom fonts (Nunito, Satoshi)
- **Deployment**: Vercel with web analytics
- **APIs**: Google Calendar API (googleapis), Resend (email)
- **Security**: Google reCAPTCHA v2

## Architecture

### Output Mode
The project uses `output: 'server'` in astro.config.mjs, meaning all routes are server-rendered by default. This enables dynamic API routes and server-side data fetching.

### Path Aliases
Configured in tsconfig.json:
- `@layouts/*` → `./src/layouts/*`
- `@components/*` → `./src/components/*`
- `@styles/*` → `./src/styles/*`

### Key Integrations

**Google Calendar API**: Used for managing class availability and bookings
- Service account authentication with credentials from environment variables
- Teacher's calendar ID and timezone configuration
- Functions in src/pages/api/availability.ts and src/pages/api/book-class.ts

**Resend Email API**: Used for all email communications
- Booking confirmations with iCalendar attachments
- Intelligent class reminder system with scheduled emails (24h and 1h before)
- Contact form submissions with dual emails (teacher notification + user confirmation)
- Sophisticated student time zone handling with conversion utilities (`resolveTimeZone`, `formatDateForZone`, `formatTimeInZone`)
- Scheduled email delivery using Resend's `scheduledAt` parameter

**reCAPTCHA**: Protects forms from spam
- Integrated in book-class.ts and contact-form.ts
- Site key exposed to frontend, secret key validated server-side

### API Routes (src/pages/api/)

All API routes follow Astro's APIRoute pattern and return JSON responses with appropriate HTTP status codes.

**availability.ts**
- GET endpoint that returns available time slots for a given date
- Queries Google Calendar for existing events using freebusy API
- Filters out booked times and returns free slots (9 AM - 6 PM, 30-minute slots)
- Falls back to demo mode with mock slots if Google Calendar is not configured or fails
- Excludes weekends and past dates automatically

**book-class.ts**
- POST endpoint for booking classes
- Validates reCAPTCHA token before processing
- Creates Google Calendar event with custom reminders (24h and 1h email, 1h and 15min popup)
- Sends HTML confirmation emails to both student and teacher with different templates
- Implements intelligent reminder scheduling:
  - Classes < 24h away: only 1h reminder
  - Classes 24-48h away: only 1h reminder
  - Classes ≥ 48h away: both 24h and 1h reminders
  - Uses Resend's scheduled email feature for automatic delivery
- Handles student time zone conversions throughout (confirmation emails show times in student's zone)
- Uses Google Service Account authentication (not OAuth)

**contact-form.ts**
- POST endpoint for general inquiries
- Validates reCAPTCHA token
- Sends two emails: teacher notification (with reply-to set to user) and user confirmation
- Falls back to demo mode if Resend is not configured
- Teacher email: ferrealspanish@gmail.com

**send-reminder.ts**
- POST endpoint for manual reminder triggering (optional fallback)
- Supports two reminder types: '24h' and '1h' before class
- Sends reminder emails with class details and Meet link
- Note: The primary reminder system is built into book-class.ts using Resend's scheduled emails

### Component Structure

**Page Components** (src/pages/)
- index.astro - Landing page
- schedule-class.astro - Class booking interface with calendar
- contact.astro - Contact form
- about.astro - About page
- sitemap.xml.ts - Dynamic XML sitemap generation

**Reusable Components** (src/components/)
- Hero.astro, Features.astro, Pricing.astro - Landing page sections
- CallToAction.astro - CTA sections
- PopularPrograms.astro, FullProgram.astro - Course offerings
- About.astro, QuoteSection.astro - Content sections
- ui/button.astro - Reusable button component

**Layout** (src/layouts/)
- Layout.astro - Main layout with SEO meta tags, Open Graph, Twitter cards, and Google/Bing verification

### Styling Approach

Custom CSS variables defined in global.css:
- `--background-primary`, `--background-secondary`
- `--button-primary`, `--button-secondary`
- `--footer-background`, `--accent`, `--accent-dark`

**Important**: Never use Tailwind's `@apply` directive per the Cursor rules. Use utility classes directly in components.

Mobile-first responsive design with custom breakpoints for padding adjustments on small screens (iPhone XR and below).

## Environment Variables

Required environment variables (stored in .env, not committed):

**Google Calendar API**:
- `GOOGLE_PROJECT_ID`
- `GOOGLE_PRIVATE_KEY_ID`
- `GOOGLE_PRIVATE_KEY` (newlines must be preserved - code handles `\n` replacement)
- `GOOGLE_CLIENT_EMAIL`
- `GOOGLE_CLIENT_ID`
- `TEACHER_CALENDAR_ID` (defaults to 'primary')
- `TEACHER_TIME_ZONE` (defaults to 'America/New_York')
- `TEACHER_MEET_ROOM` (optional - fixed Google Meet room URL)

**Email (Resend)**:
- `RESEND_API_KEY`
- `FROM_EMAIL` (defaults to 'noreply@ferrealspanish.com')

**Security**:
- `RECAPTCHA_SECRET_KEY`
- `RECAPTCHA_SITE_KEY` (used in frontend)

**Development Notes**:
- APIs gracefully degrade when credentials are missing (demo mode for availability.ts and contact-form.ts)
- Google Calendar uses Service Account authentication, not OAuth
- All API routes include proper error handling and fallback responses

## Code Style Guidelines (from .cursor/rules/astrorules.mdc)

- Write concise, technical TypeScript/JavaScript
- Leverage Astro's partial hydration and static generation
- Minimize client-side JavaScript - prefer server-side rendering
- Use descriptive variable names
- Never use Tailwind's `@apply` directive - use utility classes directly
- Implement proper component composition
- Use client:* directives sparingly:
  - `client:load` - immediate interactivity
  - `client:idle` - deferred interactivity
  - `client:visible` - hydrate when visible
- Follow Astro's file-based routing
- Ensure semantic HTML and accessibility (ARIA, keyboard navigation)
- Optimize images and assets
- Use TypeScript for type safety

## Important Notes

- The site uses Vercel's adapter with web analytics enabled
- HTML compression is enabled in production builds
- Inline stylesheets optimization is set to 'auto'
- The site domain is https://ferrealspanish.com
- Custom fonts (Nunito, Satoshi) are loaded via Google Fonts and configured in Tailwind
- SEO meta tags include Google and Bing site verification
- All email templates are HTML-based with plain text fallbacks
- Mobile-responsive email templates with gradient headers and branded styling
- Time zone conversion ensures students see class times in their local timezone
- API routes return proper HTTP status codes (200, 201, 400, 403, 409, 500)

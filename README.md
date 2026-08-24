# StudyFlow

StudyFlow is a web application for organizing and supporting independent study. It brings study planning, focused work, notes, file storage, and academic utilities into one workspace.

## Features

- Email authentication with registration, login, password recovery, and password reset
- Personal dashboard with recent activity, study tips, notifications, and a live clock
- Task management for planning and tracking study work
- Notes with rich-text editing, code blocks, tables, drawings, images, and sharing
- Document storage with file upload, preview, and deletion
- Document summarization through the application API
- Focus mode with a Pomodoro timer
- GPA calculation
- User profile editing
- Light and dark theme support

## Technology

- [Next.js](https://nextjs.org/) with the App Router
- TypeScript
- React
- Supabase Authentication, PostgreSQL, and Storage
- Tailwind CSS/PostCSS
- Vitest and Testing Library

## Requirements

- Node.js 18.18 or newer
- npm
- A Supabase project

## Getting Started

1. Clone the repository and enter the project directory:

   ```bash
   git clone <repository-url>
   cd studyflow-main
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Create a `.env.local` file in the project root:

   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

   Copy these values from the Supabase project settings. Do not commit `.env.local` or expose private service-role credentials in client-side code.

4. Apply the database schema and storage setup from the `supabase/migrations` directory to your Supabase project. Run the SQL files in migration order, or use the Supabase CLI if it is configured for your project.

5. Start the development server:

   ```bash
   npm run dev
   ```

   Open [http://localhost:3000](http://localhost:3000) in a browser.

## Available Scripts

```bash
npm run dev      # Start the development server
npm run build    # Create a production build
npm run start    # Start the production server
npm run lint     # Run ESLint
npm test         # Run the Vitest test suite
```

To run tests in watch mode:

```bash
npx vitest
```

## Project Structure

```text
src/app/                  Application routes and UI components
src/app/(auth)/           Authentication pages
src/app/(dashboard)/      Authenticated dashboard pages
src/app/api/              Server-side API routes
src/lib/supabase/         Supabase browser and server clients
src/tests/                 Backend and frontend tests
supabase/migrations/      Database schema and storage configuration
public/                    Static assets
```

## Supabase Configuration

StudyFlow uses Supabase for authentication, database access, and file storage. Before using notes or storage features, ensure that the SQL migrations in `supabase/migrations` have been applied and that the required storage bucket policies are enabled.

For authentication redirects, configure the local application URL in Supabase as:

```text
http://localhost:3000
```

Add the deployed application URL as an additional redirect URL when deploying the application.

## Testing

The test suite is organized into frontend and backend tests under `src/tests`. Run the complete suite with:

```bash
npm test -- --run
```

Tests that depend on Supabase require the corresponding environment variables and a suitable test project or test configuration.

## Production Build

Build and start the application with:

```bash
npm run build
npm run start
```

Set the same Supabase environment variables in the production environment before starting the server. For deployment-specific configuration, consult the hosting provider's Next.js documentation.

## Academic Context

StudyFlow was developed as part of the thesis project documented in this repository. The thesis documentation describes the application's goals, design decisions, and evaluation context.

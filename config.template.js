/**
 * API Configuration Template
 * 
 * HOW TO USE:
 * 1. Copy this file to config.js (git-ignored, never commit credentials)
 * 2. Replace the placeholder values with your actual API keys
 * 3. The app will load API_CONFIG from this file at runtime
 */

const API_CONFIG = {
  // Reed.co.uk Jobs API credentials
  // Get these from: https://www.reed.co.uk/developers
  // Register for a free account, then create an API key in the developer portal.
  // Authentication: HTTP Basic Auth — API key is the username, password is empty.
  REED_API_KEY: 'your_reed_api_key_here',

  // Anthropic API key for job fit scorer
  // Get this from: https://console.anthropic.com/
  // Note: Currently expects to use browser's existing Claude connection
  // If adding direct API calls, add your key here - but keep private locally
  ANTHROPIC_API_KEY: '', // Leave empty if using Claude web UI

  // Personal information for customization
  HEADER_INFO: 'Your Job Title · Your Location · 2024', // e.g. 'Delivery Manager · County Limerick · 2024' - displayed in the header
  PROFILE_SUMMARY: 'Add your professional summary here. Include your current role, experience, and what you\'re looking for.', // Used by the job fit scorer
  ROLE_PLACEHOLDER: 'e.g. Job Title', // Placeholder text for role input fields
  LOCALE: 'en-US', // Locale for date/time formatting (e.g. 'en-US', 'en-GB', 'en-IE')
  ALERT_STRINGS: [
    { name: 'Role 1 — Location', string: '"Role Name" Location keywords' },
    { name: 'Role 2 — Location', string: '"Another Role" Location keywords' },
  ], // Google alert search strings - each object has a name and the search string to copy

  // Job titles used by the "Search all titles" button in Live Jobs.
  // Each string is sent to the Reed API as a phrase-quoted keyword search.
  // Add, remove, or edit titles to match the roles you are targeting.
  SEARCH_TITLES: [
    'delivery manager',
    'engineering manager',
    'scrum master',
    'technical project manager',
    'programme manager',
    'agile coach',
    'release manager',
    'development manager',
  ],
};

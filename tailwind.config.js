import forms from '@tailwindcss/forms';
import typography from '@tailwindcss/typography';
import containerQueries from '@tailwindcss/container-queries';

/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./admin/**/*.{js,ts,jsx,tsx}",
        "./student/**/*.{js,ts,jsx,tsx}",
        "./pages/**/*.{js,ts,jsx,tsx}",
        "./lib/**/*.{js,ts,jsx,tsx}",
        "./App.tsx",
        "./index.tsx",
    ],
    theme: {
        extend: {
            colors: {
                primary: '#137fec',
                navy: '#0f172a',
                'bg-light': '#f6f7f8',
                'bg-dark': '#101922',
            },
            fontFamily: {
                sans: ['Lexend', 'Plus Jakarta Sans', 'sans-serif', 'system-ui'],
            },
        },
    },
    plugins: [
        forms,
        typography,
        containerQueries,
    ],
}

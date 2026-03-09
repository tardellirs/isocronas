import React from 'react';

const icons = {
    car: <g><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /><circle cx="7" cy="17" r="2" /><circle cx="17" cy="17" r="2" /></g>,
    bike: <g><circle cx="5.5" cy="17.5" r="3.5" /><circle cx="18.5" cy="17.5" r="3.5" /><path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h2" /></g>,
    walking: <g><circle cx="12" cy="5" r="2" /><path d="M9 20l3-6l3 6" /><path d="M6 13l6-7l6 7" /><path d="M12 9v4" /></g>,
    search: <g><circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" /></g>,
    mapPin: <g><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" /></g>,
    info: <g><circle cx="12" cy="12" r="10" /><path d="M12 16v-4" /><path d="M12 8h.01" /></g>,
    alert: <g><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></g>,
    check: <g><polyline points="20 6 9 17 4 12" /></g>,
    sparkles: <g><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /><path d="M5 3v4" /><path d="M9 5H5" /></g>,
    home: <g><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></g>,
    chevronUp: <g><path d="m18 15-6-6-6 6" /></g>,
    chevronDown: <g><path d="m6 9 6 6 6-6" /></g>,
    layers: <g><polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" /><polyline points="2 12 12 17 22 12" /></g>,
    hospital: <g><path d="M12 6v12" /><path d="M6 12h12" /></g>,
    tree: <g><path d="M12 19v-6" /><path d="M12 13C8 13 6 8 8 5s4-1 4-1 4 2 4 4-2 5-4 5Z" /></g>,
};

const Icon = ({ name, size = 20, className = '' }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        {icons[name] || icons.mapPin}
    </svg>
);

export default Icon;

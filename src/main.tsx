import { render } from 'preact';
import { App } from './app/App';
import { go } from './app/state';
import { pendingJoinCode } from './app/Online';
import './ui/styles.css';

// Styles additionnels des jeux (chargés s'ils existent).
import.meta.glob('./ui/*.css', { eager: true });

// Lien d'invitation ?salon=CODE → écran « Rejoindre »
if (pendingJoinCode()) go({ name: 'online' });

render(<App />, document.getElementById('app')!);

// Application installable et utilisable hors ligne (sauf salon en ligne).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}

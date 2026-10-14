import {
  BookOpen, ChevronLeft, ChevronRight, Compass, Crown, Eye, Film, HelpCircle,
  MessageSquareQuote, Mic, PanelLeftClose, PanelRightClose, RotateCcw, ScrollText,
  Send, Shield, SlidersHorizontal, Sparkles, Swords, Volume2, Wand2, X, Zap,
  createIcons
} from 'lucide';
import { WizardChessApp } from './app/WizardChessApp.js';
import { installActionDispatcher } from './ui/action-dispatcher.js';
import './styles/main.css';

const app = new WizardChessApp();
window.app = app;
const lucideIcons = {
  BookOpen, ChevronLeft, ChevronRight, Compass, Crown, Eye, Film, HelpCircle,
  MessageSquareQuote, Mic, PanelLeftClose, PanelRightClose, RotateCcw, ScrollText,
  Send, Shield, SlidersHorizontal, Sparkles, Swords, Volume2, Wand2, X, Zap
};
createIcons({ icons: lucideIcons });
installActionDispatcher(app);

window.addEventListener('keydown', (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = event.target && event.target.tagName;
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || !document.getElementById('start-screen').classList.contains('hidden')) return;
  if (event.key.toLowerCase() === 'z') { event.preventDefault(); app.undoMove(); }
  else if (event.key.toLowerCase() === 'y') { event.preventDefault(); app.redoMove(); }
  else if (event.key === 'Escape') { app.cancelPromotion(); app.toggleModal('settings-modal', false); app.toggleModal('help-modal', false); }
});

export { app };

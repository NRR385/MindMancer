export function renderProgressBar(currentQuestion: number, maxQuestions = 20): HTMLElement {
  const container = document.createElement('div');
  container.className = 'progress-container';

  const header = document.createElement('div');
  header.className = 'progress-header';

  const label = document.createElement('span');
  label.className = 'progress-label';
  label.textContent = `Question ${Math.min(currentQuestion, maxQuestions)} of ${maxQuestions}`;

  const remaining = document.createElement('span');
  remaining.className = 'progress-remaining';
  const left = Math.max(0, maxQuestions - currentQuestion);
  remaining.textContent = `${left} question${left === 1 ? '' : 's'} remaining`;

  header.appendChild(label);
  header.appendChild(remaining);

  const track = document.createElement('div');
  track.className = 'progress-track';

  const fill = document.createElement('div');
  fill.className = 'progress-fill';
  const percentage = Math.min(100, Math.max(5, (currentQuestion / maxQuestions) * 100));
  fill.style.width = `${percentage}%`;

  track.appendChild(fill);
  container.appendChild(header);
  container.appendChild(track);

  return container;
}

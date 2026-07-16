const express = require('express');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 4000;

// Logging and parsing middleware
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Configure EJS view engine
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Serve static assets from public directory
app.use(express.static(path.join(__dirname, 'public')));

// Load Bubble widget settings
let bubbleSettings = {};
try {
  const rawSettings = fs.readFileSync(path.join(__dirname, 'widgets', 'bubble', 'settings.json'), 'utf-8');
  bubbleSettings = JSON.parse(rawSettings);
} catch (err) {
  console.error('Error loading bubble settings:', err);
}

// Load Eyecatcher widget settings
let eyecatcherSettings = {};
try {
  const rawSettings = fs.readFileSync(path.join(__dirname, 'widgets', 'eyecatcher', 'settings.json'), 'utf-8');
  eyecatcherSettings = JSON.parse(rawSettings);
} catch (err) {
  console.error('Error loading eyecatcher settings:', err);
}

// In-memory databases
let tasks = [
  { id: 1, text: 'Master HTMX out-of-band swaps', completed: true },
  { id: 2, text: 'Build interactive tabs with Alpine.js', completed: false },
  { id: 3, text: 'Explore Tailwind CSS v4 styling', completed: false },
];

const tools = [
  { name: 'HTMX', description: 'Access AJAX, CSS Transitions, WebSockets and Server Sent Events directly in HTML.', category: 'Frontend' },
  { name: 'Alpine.js', description: 'A rugged, minimal tool for composing behavior directly in your markup.', category: 'Frontend' },
  { name: 'Tailwind CSS v4', description: 'A utility-first CSS framework featuring a brand-new Rust engine.', category: 'Styling' },
  { name: 'Express.js', description: 'Fast, unopinionated, minimalist web framework for Node.js.', category: 'Backend' },
  { name: 'Node.js', description: 'JavaScript runtime built on Chrome\'s V8 engine.', category: 'Runtime' },
  { name: 'React', description: 'A library for building web and native user interfaces.', category: 'Frontend' },
  { name: 'Vue.js', description: 'An approachable, performant and versatile framework for building web UIs.', category: 'Frontend' },
  { name: 'Go', description: 'An open-source programming language supported by Google.', category: 'Language' },
  { name: 'Rust', description: 'A language empowering everyone to build reliable and efficient software.', category: 'Language' },
];

// Helper to calculate active tasks count
function getActiveTasksCount() {
  return tasks.filter(t => !t.completed).length;
}

// Render HTML template helper for task counter OOB swap
function renderTaskCounterHTML() {
  const count = getActiveTasksCount();
  return `<span id="task-counter" hx-swap-oob="true" class="bg-indigo-500 text-white text-xs font-semibold px-2 py-0.5 rounded-full shadow-sm transition-all duration-300">
    ${count} active
  </span>`;
}

/* ==========================================================================
   Routes & HTMX Endpoints
   ========================================================================== */

// 1. Home Page Route - Map eyecatcherSettings to the explicit variable expected by the template
// 1. Home Page Route - Pass separate config payloads without overlapping properties
app.get('/', (req, res) => {
  res.render('index', {
    bubbleSettings: bubbleSettings,
    eyecatcherSettings: eyecatcherSettings
  });
});

// 2. Live Server Metrics Endpoint (HTMX Polling demo)
app.get('/api/metrics', (req, res) => {
  const cpuLoad = Math.floor(15 + Math.random() * 35); // 15% to 50%
  const memoryUsage = Math.floor(45 + Math.random() * 15); // 45% to 60%
  const activeUsers = Math.floor(120 + Math.random() * 15 - 7); // ~120 users

  res.render('partials/metricsCards', {
    cpu: cpuLoad,
    ram: memoryUsage,
    users: activeUsers
  });
});

// 3. Active Search Endpoint (HTMX Keyup triggered)
app.get('/api/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase().trim();

  // If query is empty, return all items
  const filtered = query
    ? tools.filter(tool =>
      tool.name.toLowerCase().includes(query) ||
      tool.description.toLowerCase().includes(query) ||
      tool.category.toLowerCase().includes(query)
    )
    : tools;

  res.render('partials/searchResults', {
    tools: filtered,
    query: req.query.q || ''
  });
});

// 4. Task Board: GET list of tasks
app.get('/api/tasks', (req, res) => {
  res.render('partials/tasksList', { tasks });
});

// 5. Task Board: POST add task
app.post('/api/tasks', (req, res) => {
  const text = (req.body.text || '').trim();

  // Simple validation for empty text
  if (!text) {
    res.status(422).send(`
      <div id="validation-msg" class="text-xs text-rose-500 font-medium mt-1.5 flex items-center gap-1 animate-pulse">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="w-3.5 h-3.5">
          <path fill-rule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clip-rule="evenodd" />
        </svg>
        Task description cannot be empty
      </div>
    `);
    return;
  }

  // Create new task object
  const newTask = {
    id: tasks.length ? Math.max(...tasks.map(t => t.id)) + 1 : 1,
    text: text,
    completed: false
  };

  tasks.push(newTask);

  // Render the newly created task EJS partial and append custom OOB updates
  res.render('partials/taskItem', { task: newTask }, (err, html) => {
    if (err) {
      console.error(err);
      return res.status(500).send('Error rendering task template');
    }
    res.send(`
      ${html}
      ${renderTaskCounterHTML()}
      <div id="validation-msg" hx-swap-oob="true"></div>
    `);
  });
});

// 6. Task Board: Toggle completion
app.post('/api/tasks/:id/toggle', (req, res) => {
  const id = parseInt(req.params.id);
  const task = tasks.find(t => t.id === id);

  if (task) {
    task.completed = !task.completed;

    // Render the updated task EJS partial and append count OOB update
    res.render('partials/taskItem', { task }, (err, html) => {
      if (err) {
        console.error(err);
        return res.status(500).send('Error rendering task template');
      }
      res.send(`
        ${html}
        ${renderTaskCounterHTML()}
      `);
    });
  } else {
    res.status(404).send('Task not found');
  }
});

// 7. Task Board: DELETE a task
app.delete('/api/tasks/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const index = tasks.findIndex(t => t.id === id);

  if (index !== -1) {
    tasks.splice(index, 1);

    // Return empty body to remove element + counter update OOB
    res.send(`
      ${renderTaskCounterHTML()}
    `);
  } else {
    res.status(404).send('Task not found');
  }
});


// Start server
app.listen(PORT, () => {
  console.log(`==================================================`);
  console.log(`🚀 HTMX + Alpine.js + EJS Server Running!`);
  console.log(`👉 http://localhost:${PORT}`);
  console.log(`==================================================`);
});

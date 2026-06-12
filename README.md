# Flex.ai - Authentication System & Management Dashboard

Flex.ai is a clean, modern, and lightweight web application prototype featuring a full authentication system (login, registration) backed by **SurrealDB**. It is designed with clean visual guidelines, offering a smooth consumer-friendly user experience.

---

## ⚡ Key Features

- **Dual-Theme Support**:
  - A clean, modern, and consumer-friendly **Light Mode** by default.
  - A premium **Dark Mode** toggle available at the top-right corner, persistent across sessions (`localStorage`).
- **SurrealDB Integration**:
  - Automatically runs an embedded instance of SurrealDB using the native `surrealkv` storage engine.
  - Seedes a default administrator account automatically upon first launch.
- **Role-Based Interfaces**:
  - **Standard User Dashboard**: Displays profile details, session security status, and a mock interactive SVG activity chart.
  - **Administrator Dashboard**: Includes a user management table displaying all registered users from the database, system logs console, and a direct interactive **SurrealQL Query Console** to execute database statements in real-time.
- **Real-Time System Metrics**: Displays server metrics including CPU usage, RAM utilization, processed API requests, and database connectivity.

---

## 🛠️ Technology Stack

- **Backend**: Node.js & Express.
- **Database**: SurrealDB (v3.1.4, running locally as a child process).
- **Frontend**: Vanilla HTML5, CSS3 (Glassmorphism, CSS Custom Properties, smooth transitions), and modern Vanilla JavaScript.
- **Typography**: Outfit (main typography) and JetBrains Mono (monospaced content).

---

## 🚀 Getting Started

### Prerequisites

Ensure you have **Node.js** (v18+) installed on your machine.

### Installation

1. Clone or copy this repository to your local directory.
2. Install the Node.js dependencies:
   ```bash
   npm install
   ```

### Running the Server

Start the application in development mode (with auto-reload on changes):
```bash
npm run dev
```

Or run it in standard mode:
```bash
npm start
```

*Note: The server will automatically spawn the SurrealDB database process on port `8000` and create the required namespace and database configurations. There is no need for manual database setup.*

### Accessing the Web App

Open your browser and navigate to:
👉 **[http://localhost:3000](http://localhost:3000)**

### Default Credentials

To explore the administration dashboard, log in with the default seeded administrator account:
- **Username**: `admin`
- **Password**: `admin`

Any user can also register a new standard account directly from the login page by clicking "Créer un compte".

---

## 📂 Project Structure

- `server.js` - Express backend server managing routing and spawning SurrealDB.
- `package.json` - Dependency configurations and scripts.
- `public/` - Static files served to the browser:
  - `index.html` - Dual-view structure (Authentication forms and Dashboard layouts).
  - `style.css` - UI theme layouts (light default and dark overrides).
  - `app.js` - Frontend logic for state management, API requests, and live metric rendering.

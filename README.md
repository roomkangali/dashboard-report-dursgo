# dashboard-report-dursgo
Dashboard Report | DursGo


## Features

*   **📊 Interactive Overview**: Get a high-level view of your application's security posture with dynamic charts and statistics (Severity Distribution, Vulnerability Status).
*   **📂 Project Management**: A centralized hub to manage multiple scan reports. View history, track progress, and organize your security audits.
*   **🔍 Detailed Findings**: Explore vulnerabilities with rich details, including severity levels, descriptions, evidence, attack scenarios, and remediation recommendations.
*   **🗺️ Attack Surface Map**: Visualize the application's attack surface to understand potential entry points.
*   **🔐 User System**: Secure authentication system (Login/Register) to protect your reports.
*   **📱 Responsive Design**: Modern, dark-themed UI built with Tailwind CSS for a comfortable viewing experience on any device.

## Tech Stack

*   **Frontend**: HTML5, Tailwind CSS, JavaScript (Vanilla), Chart.js
*   **Backend**: Node.js, Express.js
*   **Database**: SQLite (Lightweight, serverless)
*   **Authentication**: Passport.js (JWT Strategy)

## Installation

### Prerequisites
*   [Node.js](https://nodejs.org/) (v14 or higher)
*   [npm](https://www.npmjs.com/) (Node Package Manager)

### Steps

1.  **Clone the Repository**
    ```bash
    git clone https://github.com/roomkangali/dashboard-report-dursgo.git
    cd dashboard-report-dursgo
    ```

2.  **Install Dependencies**
    ```bash
    npm install
    ```

3.  **Start the Server**
    ```bash
    npm start
    ```
    *Alternatively, run:* `node server.js`

4.  **Access the Dashboard**
    Open your web browser and navigate to:
    ```
    http://localhost:3000
    ```
    *(Note: If running on a server, use server's IP address, e.g., `http://192.168.1.x:3000`)*

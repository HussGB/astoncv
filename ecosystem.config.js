// PM2 process definition for local/server deployment.
module.exports = {
  apps: [
    {
      // Main app process details.
      name: "astoncv",
      script: "src/app.js",
      instances: 1,
      exec_mode: "fork",
      cwd: "/var/www/aston_p3/husnain",
      env: {
        // Defaults for non-production runs.
        NODE_ENV: "development"
      },
      env_production: {
        // Overrides used when running in production mode.
        NODE_ENV: "production"
      },
      time: true
    }
  ]
};

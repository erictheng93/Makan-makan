<?php
/////// Database configuration using environment variables /////
$dbhost_name = $_ENV['DB_HOST'] ?? 'localhost'; // Database host
$mysql_database = $_ENV['DB_NAME'] ?? 'makanmakan';  // Database name
$mysql_username = $_ENV['DB_USER'] ?? 'root';    // Database username
$mysql_password = $_ENV['DB_PASSWORD'] ?? '';   // Database password (never hardcode!)

// Check if required environment variables are set
if (empty($_ENV['DB_PASSWORD'])) {
    error_log('WARNING: DB_PASSWORD environment variable is not set');
    // In production, consider throwing an exception instead of continuing
    // throw new Exception('Database password must be set via environment variables');
}
//////// End of database configuration //////

//////// Database connection initialization /////////
$link = mysqli_connect($dbhost_name, $mysql_username, $mysql_password);
if (!$link) {
    error_log('Failed to connect to database: ' . mysqli_connect_error());
    die('Unable to connect to SQL server');
}

if (!mysqli_select_db($link, $mysql_database)) {
    error_log('Failed to select database: ' . mysqli_error($link));
    die('Unable to select database');
}

?> 
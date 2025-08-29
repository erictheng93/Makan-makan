<?php
/////// Update your database login details here /////
$dbhost_name = "localhost"; // Your host name 
$mysql_database = "makanmakan";  // Your database name
$mysql_username = "makanmakan";    // Your login userid 
$mysql_password = "OniABLITmotA";   // Your password 
//////// End of database details of your server //////

//////// Do not Edit below /////////
$link = mysqli_connect("localhost",$mysql_username,$mysql_password);// or die ("Unable to connect to SQL server");
mysqli_select_db($link,$mysql_database);// or die ("Unable to select database");

?> 
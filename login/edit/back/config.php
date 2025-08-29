<?Php
/////// Update your database login details here /////
$dbhost_name = "localhost"; // Your host name 
$database = "makanmakan";       // Your database name
$username = "root";            // Your login userid 
$password = "12345";            // Your password 
//////// End of database details of your server //////

//////// Do not Edit below /////////
try {
$dbo = new PDO('mysql:host='.$dbhost_name.';dbname='.$database, $username, $password);
} catch (PDOException $e) {
print "Error!: " . $e->getMessage() . "<br/>";
die();
}
?> 
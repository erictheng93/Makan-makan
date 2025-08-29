<?php

echo getcwd()."<br>";
echo $_SERVER["HTTPS"]."<br>";
echo $_SERVER["HTTP_HOST"]."<br>";
echo $_SERVER["SERVER_PORT"]."<br>";
echo $_SERVER["REQUEST_URI"]."<br>";
echo $_SERVER["QUERY_STRING"]."<br>";
echo __FILE__."<br>";
echo dirname(__FILE__)."<br>";
echo __DIR__."<br>";
echo basename(dirname(__FILE__))."<br>";	
echo $_SERVER["DOCUMENT_ROOT"]."<br>";
echo $_SERVER["PHP_SELF"]."<br>";//ok
echo $_SERVER["SCRIPT_FILENAME"]."<br>";
//echo $_SERVER['SERVER_ADDR']."<br>";
echo $_SERVER['SERVER_NAME']."<br>";
echo $_SERVER['SCRIPT_FILENAME']."<br>";
echo $_SERVER['REMOTE_PORT']."<br>";
echo $_SERVER['SCRIPT_NAME']."<br>";
echo $_SERVER["DOCUMENT_ROOT"]."<br>";
echo realpath('getcwd.php')."<br>"; 
echo realpath('/')."<br>"; 
$path_parts = pathinfo($_SERVER['SCRIPT_NAME']);
echo $path_parts['dirname']."<br>";
echo $path_parts['basename']."<br>";
echo $path_parts['extension']."<br>";
echo $path_parts['filename']."<br>";
?>
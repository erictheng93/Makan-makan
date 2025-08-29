<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
<title>無標題文件</title>
</head>

<body>
<?php
$mysql_url="localhost";//210.70.80.96;
$mysql_database="food";
$mysql_username="root";
$mysql_password="12345";
$link=mysqli_connect($mysql_url,$mysql_username,$mysql_password,$mysql_database)or die("資料庫聯結失敗");
?>
</body>
</html>
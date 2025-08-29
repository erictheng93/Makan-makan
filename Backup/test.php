<?php
$shop=$_GET["s"];
$meja=$_GET["m"];
require "config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇Banner要顯示的物件 開始 */
$sql="SELECT * FROM shop_table WHERE st_shopID='$shop' AND st_tableNumber='$meja'";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}
/* 選擇Banner要顯示的物件 結束 */


?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>

<body>
	<?php
	 echo "ShopID:".$shop."<br>";
	 echo "TableNumber:".$meja."<br>";
	?>
</body>
</html>
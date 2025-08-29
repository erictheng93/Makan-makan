<?php 
$kedai=$_GET['k'];
$meja=$_GET["m"];
require "config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇Banner要顯示的物件 開始 */
$sql="SELECT * FROM shop_table WHERE shop_ID='$kedai' AND st_tableNumber='$meja'";//搜索資料指令 捉取數據庫裡Banner的資料
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
	<div>
					
		<a href="index.php?k=<?php echo $arr[0]['shop_ID']?>&m=<?php echo $arr[0]['st_tableNumber'] ?>">
			<?php echo 'k='.$arr[0]['shop_ID'].'m='.$arr[0]['st_tableNumber'].'<p>' ?></a>
		
	</div>
</body>
</html>
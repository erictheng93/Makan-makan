<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN"
    "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<?php 
if (isset($_GET['k'])){
	$kedai=$_GET['k'];
}
if (isset($_GET['kedai'])){
	$kedai=$_GET['kedai'];
}
$table="";
require "config.php";
/* 選擇shop_info要顯示的物件 開始 */
$sql="SELECT * FROM shop_info WHERE shop_ID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}

/* 選擇shop_info要顯示的物件 結束 */
$sql2="SELECT * FROM shop_table WHERE st_shopID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result2; $i++){
$arr2[$i]=mysqli_fetch_array($result2);
}
echo $arr[0]['shop_name']."<br>";
for($i=0; $i<$number_result2; $i++){
$table=$table.$arr2[$i]['st_tableNumber'].",";
}
echo "餐桌編號為:".substr($table,0,-1);
?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
<title>phpQr Demonstration</title>
</head>
<body>
<form action="qrcode-form-index.php">
  <label for="qrcodedata">選擇列印QRCode的餐桌：</label>
  <label for="select">Select:</label>
  <select name="select" id="select">
    <option value="a">全選</option>
	 <?php  for($i=0; $i<$number_result2; $i++){
			
		echo "<option value=".$arr2[$i]['st_tableNumber'].">".$arr2[$i]['st_tableNumber']."</option>";
		}
	  ?>
  </select>
  <label for="qrcodedata"><br />
    QRCode data</label>
  <input name="qrcodedata" type="hidden" id="qrcodedata" value="<?php echo 'http://localhost/qrcode-form-index.php?k='.$kedai ?>" size="40"/><br/>
 
	<input type="hidden" id="quality" name="kedai" value="<?php echo $kedai?>"/>
  <input type="submit"/>
  
</form>
<?php 
	 	if(isset($_GET['kedai'])) $kedai = $_GET['kedai'];
		 if(isset($_GET['select'])) $select = $_GET['select'];
if(isset($_GET['qrcodedata']) && strlen($_GET['qrcodedata'])&& $select=='a')
{
	
 for($i=0; $i<$number_result2; $i++){
	 printf("<img src='qrcode-display.php?data=%s&k=%s&t=%s'/>", $_GET['qrcodedata']."-".$arr2[$i]['st_tableNumber'],$kedai,$arr2[$i]['st_tableNumber']);
	 echo "&nbsp;&nbsp;";
	
 }
 	printf("<br><input type='button' name='button' value='列印' onClick='location.href=\"print.php?k=%s&t=%s\"'/>",$kedai,$select);
 
}else if(isset($_GET['qrcodedata']) && strlen($_GET['qrcodedata'])){
 if(isset($_GET['kedai'])) $kedai = $_GET['kedai'];
  if(isset($_GET['select'])) $select = $_GET['select'];
  
  printf("<img src='qrcode-display.php?data=%s&k=%s&t=%s'/>", $_GET['qrcodedata']."-".$select,$kedai,$select);
	/*
	echo "<br><input type='button' name='button' value='列印' onClick='location.href=print.php?k=".$_GET['kedai']."&t=".$_GET['select']."''/>";
	*/
	printf("<br><input type='button' name='button' value='列印' onClick='location.href=\"print.php?k=%s&t=%s\"'/>",$kedai,$select);
}
?>
</body>
</html>
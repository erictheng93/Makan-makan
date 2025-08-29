<?php
session_save_path("../session_data"); //把成功login之後的session存在session data裡面
session_start(); //Session開始
$kedai=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];

$table="";
require "../../config.php";


/* 選擇shop_table	要顯示的物件 結束 */
$sql2="SELECT * FROM shop_table WHERE shop_ID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result2; $i++){
$arr2[$i]=mysqli_fetch_array($result2);
}
echo $kedai_nama."<br>";
for($i=0; $i<$number_result2; $i++){
$table=$table.$arr2[$i]['st_tableNumber'].",";
}
echo "餐桌編號為:".substr($table,0,-1);
?>
<html>
<head>
<title>php Qr-Code</title>
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
  <input name="qrcodedata" type="hidden" id="qrcodedata" value="<?php echo 'http://localhost/qrcode-form-index.php?k='?>" size="40"/><br/>
 
	<input type="hidden" id="quality" name="kedai" value="<?php echo $kedai?>"/>
  <input type="submit"/>
  
</form>
<?php 
	 	if(isset($_GET['kedai'])) $kedai = $_GET['kedai'];
		 if(isset($_GET['select'])) $select = $_GET['select'];
if(isset($_GET['qrcodedata']) && strlen($_GET['qrcodedata'])&& $select=='a')
{
	
 for($i=0; $i<$number_result2; $i++){
	 $data=$_GET['qrcodedata'].$_GET['kedai']."&m=".$arr2[$i]['st_tableNumber'];
	 printf("<img src='qrcode-display.php?data=%s&k=%s&t=%s'/>",urlencode($data),$kedai,$arr2[$i]['st_tableNumber']);
	 echo "&nbsp;&nbsp;";
	
 }
 	printf("<br><input type='button' name='button' value='列印' onClick='location.href=\"print.php?k=%s&t=%s\"'/>",$kedai,$select);
 
}else if(isset($_GET['qrcodedata']) && strlen($_GET['qrcodedata'])){
 if(isset($_GET['kedai'])) $kedai = $_GET['kedai'];
  if(isset($_GET['select'])) $select = $_GET['select'];
  $data=$_GET['qrcodedata'].$_GET['kedai']."&m=".$select;	
	
  printf("<img src='qrcode-display.php?data=%s&k=%s&t=%s'/>", urlencode($data),$kedai,$select);
	echo "<br>".$data;

	printf("<br><input type='button' name='button' value='列印' onClick='location.href=\"print.php?k=%s&t=%s\"'/>",$kedai,$select);///列印程式
}
?>
</body>
</html>
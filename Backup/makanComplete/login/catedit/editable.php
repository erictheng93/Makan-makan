<?php
session_save_path('../session_data');
session_start();
$kedai=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_info要顯示的物件 開始 */
$sql="SELECT * FROM shop_table WHERE shop_ID='$kedai' ORDER BY st_tableNumber ASC";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}

$sql2="SELECT * FROM shop_table WHERE shop_ID='$kedai' ORDER BY st_sn ASC";//搜索資料指令 捉取數據庫裡Banner的資料
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result2; $i++){
$arr2[$i]=mysqli_fetch_array($result2);
}

?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Edit Table</title>
</head>

<body>
	
	
<form id="form1" name="form1" method="post" action="editable2.php">
  <table width="248" border="0" cellspacing="3" cellpadding="4">
    <tbody>
      <tr>
        <td colspan="3"><?php echo $kedai_nama; ?><br>桌子編號新增刪除與修改</td>
      </tr>
      <tr>
        <td width="90" bgcolor="#BACCD3">桌子編號</td>
        <td colspan="2" bgcolor="#BACCD3">&nbsp;</td>
      </tr>
		<?php 
			for($i=0; $i<$number_result; $i++){
		?>
      <tr>
        <td bgcolor="#D7E8ED"><input type="text" maxlength="4" size="4" name="tableNumber" value="<?php echo $arr[$i]['st_tableNumber']?> "></td>        
        <td width="133" bgcolor="#D7E8ED" style="text-align:center;">
			<input type="hidden" name="sn" value="<?php echo $arr2[$i]['st_sn']?>"> <!-- 用一個hidden input把st_sn送去後方 -->
			<input type="submit" name="submit" id="submit" value="修改送出" onClick="return confirm('確定修改資料？')"></tr> <!-- 送出 -->		
		<?php 
			}
		?>
<!--
	  <tr>
       <td colspan="4" align="right" bgcolor="#94B9C5"><input type="submit" name="submit" id="submit" value="修改送出">  </td>
      </tr>
-->
    </tbody>
	  
  </table>
</form>	
</body>	
</html>
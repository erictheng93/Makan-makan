
<?php
session_save_path('../session_data');
session_start();
$kedai=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];

require "../../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_info要顯示的物件 開始 */
$sql="SELECT menu_sn, menu_foodname, menu_price, menu_pictures, menu_available FROM shop_menu WHERE shop_ID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數

for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}

?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>

<body>
	商品是否開放管理系統
<form id="form1" name="form1" method="post" action="menuPost2.php">
  <table width="729" border="0" cellspacing="3" cellpadding="4">
    <tbody>
      <tr>
        <td width="162" bgcolor="#94B9C5">食物名稱</td>
        <td width="136" bgcolor="#94B9C5">食物價格</td>
        <td width="217" bgcolor="#94B9C5">食物照片</td>
        <td width="155" bgcolor="#94B9C5">商品是否開放</td>
      </tr>
		<?php
		 for($i=0;$i<$number_result;$i++){
			 if($arr[$i]['menu_available']==1){
				 $checked='checked="checked"' ;
			 }else{
				$checked='' ;
			 }
		?>
      <tr>
        <td bgcolor="#D7E8ED"><?php echo $arr[$i]['menu_foodname']?></td>
        <td bgcolor="#D7E8ED"><?php echo $arr[$i]['menu_price']?></td>
        <td bgcolor="#D7E8ED"><img src="../edit/image/<?php echo $arr[$i]['menu_pictures']?>"></td>
		<td bgcolor="#D7E8ED"><input type="checkbox" name="checkbox<?php echo $arr[$i]['menu_sn']?>" id="checkbox" <?php echo $checked ?>></td>
      </tr>
      
		<?php
		 }
		?>
		<tr>
        <td colspan="4" align="right" bgcolor="#94B9C5"><input type="submit" name="submit" id="submit" value="修改送出"></td>
      </tr>
    </tbody>
  </table>
  <p>&nbsp;</p>
</form>
</body>
</html>
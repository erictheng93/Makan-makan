<?php

session_save_path('../session_data');
session_start();
$shop_ID=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
//echo $shop_ID;
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
$sql0="SELECT * FROM shop_ordermenu WHERE shop_ID='$shop_ID' AND shopOrder_confirm='1' AND shopOrder_make IS NULL  ORDER BY shopOrderMenu_sn ASC";//搜索訂單資料指令 捉取數據庫裡Banner的資料
$result0=mysqli_query($link,$sql0);//執行指令,並把結果存到result
$number_result0=mysqli_num_rows($result0);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result0; $i++){
$arr0[$i]=mysqli_fetch_array($result0);
}
//echo $number_result0;
?>

<!doctype html>
<html>
<head>
	
<meta charset="utf-8">
<title>廚師作菜系統</title>
</head>

<body>
廚師作菜系統
<form id="form1" name="form1" method="post">
  <table width="931" border="0" cellspacing="2" cellpadding="2">
 		
      <tr>
        <td width="59" bgcolor="#95D5F4">桌號</td>
        <td width="253" bgcolor="#95D5F4">菜單</td>
        <td width="70" bgcolor="#95D5F4">數量</td>
        <td width="372" bgcolor="#95D5F4">備註</td>
        <td width="145" bgcolor="#95D5F4">確認作好</td>
      </tr>
	  <?php
	  		for($i=0; $i<$number_result0; $i++){
				$menuSn=$arr0[$i]['shopOrderMenu_sn'];
	  	?>
      <tr>
        <td bgcolor="#D7E8ED"><?php echo $arr0[$i]['shopOrder_table'] ?></td>
        <td bgcolor="#D7E8ED"><?php echo $arr0[$i]['shopOrder_ItemName'] ?></td>
        <td bgcolor="#D7E8ED"><?php echo $arr0[$i]['shopOrder_itemQuantity'] ?></td>
        <td bgcolor="#D7E8ED"><?php echo $arr0[$i]['shopOrder_note'] ?></td>
        <td bgcolor="#D7E8ED"><input type="checkbox" onclick="window.location.href='cook.php?a=<?php echo $menuSn ?>'"></td>
	  </tr>
      <?php
			}
	  ?>
  </table>
</form>
</body>
</html>
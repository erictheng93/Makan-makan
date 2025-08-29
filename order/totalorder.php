<!doctype html>
<?php
session_save_path('../session_data');
session_start();
$shopOrder_sn=$_SESSION['shopOrder_sn'];

require "../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
$sql0="SELECT * FROM shop_ordermenu WHERE shopOrder_sn='$shopOrder_sn'";//搜索訂單資料指令 捉取數據庫裡Banner的資料
$result0=mysqli_query($link,$sql0);//執行指令,並把結果存到result
$number_result0=mysqli_num_rows($result0);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result0; $i++){
$arr0[$i]=mysqli_fetch_array($result0);
}
//echo $number_result0;
?>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>
<style type="text/css">
	body {
		background-color:#B6E4F3;
	}
</style>
<body>
餐桌:<?php 
	      echo $arr0[0]['shopOrder_table'];
	?>
<form id="form1" name="form1" method="post" action="totalorderSave.php">
  <table width="224" border="0" cellspacing="3" cellpadding="4">
	<?php 
	  $total_price=0;
	  for($i=0; $i<$number_result0; $i++){ 
		  $total_price=$total_price+$arr0[$i]['shopOrder_ItemPriceTotal'];
	 ?>
	  <tr>
        <td width="76"><?php echo $arr0[$i]['shopOrder_ItemName']?></td>
        <td width="41"><?php echo $arr0[$i]['shopOrder_ItemPriceTotal']?></td>
        <td width="71"><a href="oder_delete.php?o=<?php echo $arr0[$i]['shopOrderMenu_sn']?> & sn=<?php echo $shopOrder_sn ?>">刪除</a>/<a href="oder_edit.php?o=<?php echo $arr0[$i]['shopOrderMenu_sn']?>& sn=<?php echo $shopOrder_sn ?>">修改</a></td>
      </tr>
    <?php 
		}
	  echo "總金額:".$total_price;
	  ?>
		<tr>
        <td colspan="3" align="right"><input type="hidden" name="total_price" value="<?php echo $total_price ?>"><input type="hidden" name="shopOrder_sn" value="<?php echo $shopOrder_sn ?>"><input type="submit" name="submit" id="submit" value="送出"></td>
      </tr>
  </table>
</form>
</body>
</html>
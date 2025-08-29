<?php
session_save_path('../session_data');
session_start();
$shop_ID=$_SESSION['shop_ID'];
$kedai_nama=$_SESSION['shop_name'];
require "../../config.php";
$shopOrder_table=$_GET['a'];
$shopOrder_date=date('Y-m-d');
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
$sql0="SELECT * FROM shop_order WHERE shop_ID='$shop_ID' AND shopOrder_table='$shopOrder_table' AND shopOrder_date='$shopOrder_date' AND shopOrder_payTime IS NULL";//搜索訂單資料指令 捉取數據庫裡Banner的資料
$result0=mysqli_query($link,$sql0);//執行指令,並把結果存到result
$number_result0=mysqli_num_rows($result0);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result0; $i++){
$arr0[$i]=mysqli_fetch_array($result0);
}
$shopOrder_sn=$arr0[0]['shopOrder_sn'];
$shopOrder_price=$arr0[0]['shopOrder_price'];

$sql1="SELECT * FROM shop_ordermenu WHERE shopOrder_sn='$shopOrder_sn'";//搜索訂單資料指令 捉取數據庫裡Banner的資料
$result1=mysqli_query($link,$sql1);//執行指令,並把結果存到result
$number_result1=mysqli_num_rows($result1);//符合條件的查詢結果的筆數
for($i=0; $i<$number_result1; $i++){
$arr1[$i]=mysqli_fetch_array($result1);
}
?>

<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>

<body>
	<?php 
	echo "第".$shopOrder_table."桌<br>總金額:".$shopOrder_price."<br>";
	
	 ?>
	<table width="565" border="0" cellspacing="3" cellpadding="3">
  
    <tr>
      <td width="206">菜單名稱</td>
      <td width="81">單價</td>
      <td width="67">數量</td>
      <td width="85">單菜總價</td>
      
    </tr>
		<?php
		for($i=0; $i<$number_result1; $i++){
		?>
    <tr>
      <td><?php echo $arr1[$i]['shopOrder_ItemName']?></td>
      <td><?php echo $arr1[$i]['shopOrder_ItemPriceOrigin']?></td>
      <td><?php echo $arr1[$i]['shopOrder_itemQuantity']?></td>
      <td><?php echo $arr1[$i]['shopOrder_ItemPriceTotal']?></td>  
    </tr>
		<?php
		}
		?>
</table>
	<a href="pay.php?a=<?php echo $shopOrder_sn ?>&t=<?php echo $shopOrder_table ?>">付款</a>
</body>
</html>
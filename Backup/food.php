<?php
$kedai=$_GET['k']; //get shop
$meja=$_GET["m"]; //get table
session_save_path('session_data');
session_start();
//echo $_SESSION['kedai']."<br>";
//echo $_SESSION['meja']."<br>";

require "config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_info要顯示的物件 開始 */
$sql="SELECT * FROM shop_info WHERE shop_ID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}
/* 選擇shop_info要顯示的物件 結束 */

/* Navigation的URL導入 開始 */
$sql2="SELECT * FROM shop_table WHERE shop_ID='$kedai' AND st_tableNumber='$meja'";//搜索資料指令 捉取數據庫裡Banner的資料
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result2; $i++){
$arr2[$i]=mysqli_fetch_array($result2);
}
/* Navigation的URL導入 開始 */

/* 選擇Food主食 開始 */
$sql4="SELECT * FROM shop_menu WHERE shop_ID='$kedai' AND shopMenu_type='1' AND shopMenu_available='1'";//搜索資料指令
$result4=mysqli_query($link,$sql4);//執行指令,並把結果存到result
$number_result4=mysqli_num_rows($result4);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result4; $i++){
$arr4[$i]=mysqli_fetch_array($result4);
}
/* 選擇Food主食 結束 */

/* 選擇Drink飲品 開始 */
$sql5="SELECT * FROM shop_menu WHERE shop_ID='$kedai' AND shopMenu_type='2' AND shopMenu_available='1'";//搜索資料指令
$result5=mysqli_query($link,$sql5);//執行指令,並把結果存到result
$number_result5=mysqli_num_rows($result5);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result5; $i++){
$arr5[$i]=mysqli_fetch_array($result5);
}
/* 選擇Drink飲品 結束 */

/* 選擇小菜 開始 */
$sql6="SELECT * FROM shop_menu WHERE shop_ID='$kedai' AND shopMenu_type='3' AND shopMenu_available='1'";//搜索資料指令
$result6=mysqli_query($link,$sql6);//執行指令,並把結果存到result
$number_result6=mysqli_num_rows($result6);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result6; $i++){
$arr6[$i]=mysqli_fetch_array($result6);
}
/* 選擇小菜 結束 */

/* 選擇dessert甜品 開始 */
$sql7="SELECT * FROM shop_menu WHERE shop_ID='$kedai' AND shopMenu_type='4' AND shopMenu_available='1'";//搜索資料指令
$result7=mysqli_query($link,$sql7);//執行指令,並把結果存到result
$number_result7=mysqli_num_rows($result7);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result7; $i++){
$arr7[$i]=mysqli_fetch_array($result7);
}
/* 選擇dessert甜品 結束 */

/* 選擇配料 開始 */
$sql8="SELECT * FROM shop_menu WHERE shop_ID='$kedai' AND shopMenu_type='5' AND shopMenu_available='1'";//搜索資料指令
$result8=mysqli_query($link,$sql8);//執行指令,並把結果存到result
$number_result8=mysqli_num_rows($result8);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result8; $i++){
$arr8[$i]=mysqli_fetch_array($result8);
}
/* 選擇配料 結束 */

/* 選擇湯品 開始 */
$sql9="SELECT * FROM shop_menu WHERE shop_ID='$kedai' AND shopMenu_type='6' AND shopMenu_available='1'";//搜索資料指令
$result9=mysqli_query($link,$sql9);//執行指令,並把結果存到result
$number_result9=mysqli_num_rows($result9);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result9; $i++){
$arr9[$i]=mysqli_fetch_array($result9);
}
/* 選擇湯品 結束 */

/* 選擇其他服務 開始 */
$sql10="SELECT * FROM shop_menu WHERE shop_ID='$kedai' AND shopMenu_type='7' AND shopMenu_available='1'";//搜索資料指令
$result10=mysqli_query($link,$sql10);//執行指令,並把結果存到result
$number_result10=mysqli_num_rows($result10);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result10; $i++){
$arr10[$i]=mysqli_fetch_array($result10);
}
/* 選擇其他服務 結束 */


?>

<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>民以食為天</title>
<meta http-equiv="X-UA-Compatible" content="IE=edge" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="css/font-awesome.min.css">
<link rel="stylesheet" href="css/style.css" />
<link rel="stylesheet" href="css/tabcss.css">
</head>

<body>
<nav class="navbar">
      <div class="navbar-container container">
          <input type="checkbox" name="" id="">
          <div class="hamburger-lines">
              <span class="line line1"></span>
              <span class="line line2"></span>
              <span class="line line3"></span>
          </div>
<!--
          <ul class="menu-items">
			<li><a href="index.php?k=<?php //echo $arr2[0]['shop_ID']?>&m=<?php //echo $arr2[0]['st_tableNumber'] ?>">首頁</a></li>
              <li><a href="food.php?k=<?php //echo $arr2[0]['shop_ID']?>&m=<?php //echo $arr2[0]['st_tableNumber'] ?>">一般點餐</a></li>
              <li><a href="food-hot.php?k=<?php //echo $arr2[0]['shop_ID']?>&m=<?php //echo $arr2[0]['st_tableNumber'] ?>">熱門點餐</a></li>
              <li><a href="food-intro.php?k=<?php //echo $arr2[0]['shop_ID']?>&m=<?php //echo $arr2[0]['st_tableNumber'] ?>">店家推薦</a></li>
              <li><a href="food-bestintro.php?k=<?php //echo $arr2[0]['shop_ID']?>&m=<?php //echo $arr2[0]['st_tableNumber'] ?>">最多好評</a></li>
              <li><a href="comment.php?k=<?php //echo $arr2[0]['shop_ID']?>&m=<?php //echo $arr2[0]['st_tableNumber'] ?>">食客評議</a></li>
              <li><a href="contact.php?k=<?php //echo $arr2[0]['shop_ID']?>&m=<?php //echo $arr2[0]['st_tableNumber'] ?>">聯絡我們</a></li>
          </ul>
-->
          <!--	這邊是LOGO	開始	  -->
          <h1 class="logo">
			  <img src="image/<?php echo $arr[0]['shop_logo'] ?>" onerror="this.onerror=null; this.src='./image/sorry.jpg'" alt="目前沒有圖片"></h1> <!-- 店家的LOGO -->
		  <!--	這邊是LOGO	結束	  -->
      </div>
 </nav>

      <h2>一般點餐</h2>
      <h2 class="food-menu-heading">一般點餐</h2>
      <!-- partial:index.partial.html -->
<div class="tabs">

    <input type="radio" name="tab" id="tab1" checked="checked">
    <label for="tab1">主食</label>
    <input type="radio" name="tab" id="tab2">
    <label for="tab2">飲料</label>
    <input type="radio" name="tab" id="tab3">
    <label for="tab3">小菜</label>
    <input type="radio" name="tab" id="tab4">
    <label for="tab4">甜品</label>
    <input type="radio" name="tab" id="tab5">
    <label for="tab5">配料</label>
	<input type="radio" name="tab" id="tab6">
    <label for="tab6">湯品</label>
	<input type="radio" name="tab" id="tab7">
    <label for="tab7">其他服務</label>
	
  
    <div class="tab-content-wrapper">
<!-- Tab 1 開始	-->
      <div id="tab-content-1" class="tab-content">
        <p>
<!-- Form 開始	-->
        <form id="form1" name="form1" method="post" action="food2.php">
<table width="502" border="0" cellspacing="5" cellpadding="5">
  <tr>
	<td width="112" align="center" bgcolor="#66CC33">圖片</td>
	<td width="112" align="center" bgcolor="#66CC33">品名</td>
	<td width="112" align="center" bgcolor="#66CC33">價格</td>
	<td width="112" align="center" bgcolor="#66CC33">選擇</td>
	<td width="112" align="center" bgcolor="#66CC33">數量</td>
	<td width="112" align="center" bgcolor="#66CC33">備註</td>
  </tr>
	
<!--  這裡顯示的是食物商品價格和其他  開始 -->
  	<?php for($i=0; $i<$number_result4; $i++){ ?>
	<tr>
<!--  這裡顯示的是食物的圖片  開始 -->
		<td><input type="hidden" name="productPictures"><img src="image/<?php echo $arr4[$i]['shopMenu_pictures'] ?>" onerror="this.onerror=null; this.src='./image/sorry.jpg'" alt="目前沒有圖片" width="140" height="94"/></td>
<!--  這裡顯示的是食物的圖片  結束 -->
		
<!--  這裡顯示的是食物的名稱  開始 -->
		<td><input type="hidden" name="productName"><?php echo $arr4[$i]['shopMenu_name'] ?></td>
<!--  這裡顯示的是食物的名稱  結束 -->
	  
<!--  這裡顯示的是食物的價格  開始 -->
	<td><input type="hidden" name="productPrice"><?php echo $arr4[$i]['shopMenu_price'] ?></td>
<!--  這裡顯示的是食物的價格  結束 -->

<!--  這裡顯示的是食物的選擇按鈕  開始 -->
    <td>
      <input type="checkbox" name="checkboxgroup[]" id="checkboxgroup" />
<!--      <label for="checkbox"></label>-->
    </td>
<!--  這裡顯示的是食物的選擇按鈕  結束 -->

<!--  這裡顯示的是食物的備註  開始 -->
    <td><input type="number" name="productQuantity" min="1" max="5" placeholder="1" pattern="[0-5]+"></td>
<!--  這裡顯示的是食物的備註  結束 -->
		
<!--  這裡顯示的是食物的備註  開始 -->
    <td><input type="hidden" name="productRemark"><?php echo $arr4[$i]['shopMenu_remark'] ?></td>
<!--  這裡顯示的是食物的備註  結束 -->
  	</tr>
<?php } ?>
<!--  這裡顯示的是食物商品價格和其他  結束 -->
</table>
<input type="submit" value="加入菜單" name="submit" class="btn btn-primary">
<input type="reset" value="重新選擇" name="reset" class="btn btn-primary">
</form>
        </p>
      </div>
<!-- Tab 1 結束	-->
	
<!-- Tab 2 開始	-->
      <div id="tab-content-2" class="tab-content">
	<p>
<!-- Form 開始	-->
        <form id="form2" name="form2" method="post" action="">
<table width="502" border="0" cellspacing="5" cellpadding="5">
  <tr>
	<td width="112" align="center" bgcolor="#66CC33">圖片</td>
	<td width="112" align="center" bgcolor="#66CC33">品名</td>
	<td width="112" align="center" bgcolor="#66CC33">價格</td>
	<td width="112" align="center" bgcolor="#66CC33">選擇</td>
	<td width="112" align="center" bgcolor="#66CC33">數量</td>
	<td width="112" align="center" bgcolor="#66CC33">備註</td>
  </tr>
	
<!--  這裡顯示的是飲料價格和其他  開始 -->
  	<?php for($i=0; $i<$number_result5; $i++){ ?>
	<tr>
<!--  這裡顯示的是飲料的圖片  開始 -->
		<td><img src="image/<?php echo $arr5[$i]['shopMenu_pictures'] ?>" onerror="this.onerror=null; this.src='./image/sorry.jpg'" alt="目前沒有圖片" width="140" height="94" /></td>
<!--  這裡顯示的是飲料的圖片  結束 -->
		
<!--  這裡顯示的是飲料的名稱  開始 -->
		<td><?php echo $arr5[$i]['shopMenu_name'] ?></td>
<!--  這裡顯示的是飲料的名稱  結束 -->
	  
<!--  這裡顯示的是飲料的價格  開始 -->
	<td><?php echo $arr5[$i]['shopMenu_price'] ?></td>
<!--  這裡顯示的是飲料的價格  結束 -->

<!--  這裡顯示的是飲料的選擇按鈕  開始 -->
    <td>
      <input type="checkbox" name="checkbox1" id="checkbox1" />
      <label for="checkbox"></label>
    </td>
<!--  這裡顯示的是飲料的選擇按鈕  結束 -->

<!--  這裡顯示的是飲料的備註  開始 -->
    <td><input type="number" name="quantity" min="1" max="5" placeholder="1" pattern="[0-5]+"></td>
<!--  這裡顯示的是飲料的備註  結束 -->
		
<!--  這裡顯示的是飲料的備註  開始 -->
    <td><?php echo $arr5[$i]['shopMenu_remark'] ?></td>
<!--  這裡顯示的是飲料的備註  結束 -->
  	</tr>
<?php } ?>
<!--  這裡顯示的是飲料價格和其他  結束 -->
</table>
<input type="submit" value="加入菜單" class="btn btn-primary">
<input type="reset" value="重新選擇" class="btn btn-primary">
</form>
        </p>
      </div>
<!-- Tab 2 結束	-->
	
<!-- Tab 3 開始	-->
      <div id="tab-content-3" class="tab-content">
      	<p>
<!-- Form 開始	-->
        <form id="form2" name="form2" method="post" action="">
<table width="502" border="0" cellspacing="5" cellpadding="5">
  <tr>
	<td width="112" align="center" bgcolor="#66CC33">圖片</td>
	<td width="112" align="center" bgcolor="#66CC33">品名</td>
	<td width="112" align="center" bgcolor="#66CC33">價格</td>
	<td width="112" align="center" bgcolor="#66CC33">選擇</td>
	<td width="112" align="center" bgcolor="#66CC33">數量</td>
	<td width="112" align="center" bgcolor="#66CC33">備註</td>
  </tr>
	
<!--  這裡顯示的是飲料價格和其他  開始 -->
  	<?php for($i=0; $i<$number_result6; $i++){ ?>
	<tr>
<!--  這裡顯示的是飲料的圖片  開始 -->
		<td><img src="image/<?php echo $arr6[$i]['shopMenu_pictures'] ?>" onerror="this.onerror=null; this.src='./image/sorry.jpg'" alt="目前沒有圖片" width="140" height="94" /></td>
<!--  這裡顯示的是飲料的圖片  結束 -->
		
<!--  這裡顯示的是飲料的名稱  開始 -->
		<td><?php echo $arr6[$i]['shopMenu_name'] ?></td>
<!--  這裡顯示的是飲料的名稱  結束 -->
	  
<!--  這裡顯示的是飲料的價格  開始 -->
	<td><?php echo $arr6[$i]['shopMenu_price'] ?></td>
<!--  這裡顯示的是飲料的價格  結束 -->

<!--  這裡顯示的是飲料的選擇按鈕  開始 -->
    <td>
      <input type="checkbox" name="checkbox1" id="checkbox1" />
      <label for="checkbox"></label>
    </td>
<!--  這裡顯示的是飲料的選擇按鈕  結束 -->

<!--  這裡顯示的是飲料的備註  開始 -->
    <td><input type="number" name="quantity" min="1" max="5" placeholder="1" pattern="[0-5]+"></td>
<!--  這裡顯示的是飲料的備註  結束 -->
		
<!--  這裡顯示的是飲料的備註  開始 -->
    <td><?php echo $arr6[$i]['shopMenu_remark'] ?></td>
<!--  這裡顯示的是飲料的備註  結束 -->
  	</tr>
<?php } ?>
<!--  這裡顯示的是飲料價格和其他  結束 -->
</table>
<input type="submit" value="加入菜單" class="btn btn-primary">
<input type="reset" value="重新選擇" class="btn btn-primary">
</form>
        </p>
      </div>
<!-- Tab 3 結束	-->
	
<!-- Tab 4 開始	-->
      <div id="tab-content-4" class="tab-content">
              	<p>
<!-- Form 開始	-->
        <form id="form2" name="form2" method="post" action="">
<table width="502" border="0" cellspacing="5" cellpadding="5">
  <tr>
	<td width="112" align="center" bgcolor="#66CC33">圖片</td>
	<td width="112" align="center" bgcolor="#66CC33">品名</td>
	<td width="112" align="center" bgcolor="#66CC33">價格</td>
	<td width="112" align="center" bgcolor="#66CC33">選擇</td>
	<td width="112" align="center" bgcolor="#66CC33">數量</td>
	<td width="112" align="center" bgcolor="#66CC33">備註</td>
  </tr>
	
<!--  這裡顯示的是飲料價格和其他  開始 -->
  	<?php for($i=0; $i<$number_result7; $i++){ ?>
	<tr>
<!--  這裡顯示的是飲料的圖片  開始 -->
		<td><img src="image/<?php echo $arr7[$i]['shopMenu_pictures'] ?>" onerror="this.onerror=null; this.src='./image/sorry.jpg'" alt="目前沒有圖片" width="140" height="94" /></td>
<!--  這裡顯示的是飲料的圖片  結束 -->
		
<!--  這裡顯示的是飲料的名稱  開始 -->
		<td><?php echo $arr7[$i]['shopMenu_name'] ?></td>
<!--  這裡顯示的是飲料的名稱  結束 -->
	  
<!--  這裡顯示的是飲料的價格  開始 -->
	<td><?php echo $arr7[$i]['shopMenu_price'] ?></td>
<!--  這裡顯示的是飲料的價格  結束 -->

<!--  這裡顯示的是飲料的選擇按鈕  開始 -->
    <td>
      <input type="checkbox" name="checkbox1" id="checkbox1" />
      <label for="checkbox"></label>
    </td>
<!--  這裡顯示的是飲料的選擇按鈕  結束 -->

<!--  這裡顯示的是飲料的備註  開始 -->
    <td><input type="number" name="quantity" min="1" max="5" placeholder="1" pattern="[0-5]+"></td>
<!--  這裡顯示的是飲料的備註  結束 -->
		
<!--  這裡顯示的是飲料的備註  開始 -->
    <td><?php echo $arr7[$i]['shopMenu_remark'] ?></td>
<!--  這裡顯示的是飲料的備註  結束 -->
  	</tr>
<?php } ?>
<!--  這裡顯示的是飲料價格和其他  結束 -->
</table>
<input type="submit" value="加入菜單" class="btn btn-primary">
<input type="reset" value="重新選擇" class="btn btn-primary">
</form>
        </p>
      </div>
<!-- Tab 4 結束	-->
      
<!-- Tab 5 開始	-->
      <div id="tab-content-5" class="tab-content">        
        <p>功能正在完善中，敬請期待 </p>
      </div>
<!-- Tab 5 結束	-->

<!-- Tab 6 開始	-->
      <div id="tab-content-6" class="tab-content">        
        <p>功能正在完善中，敬請期待 </p>
      </div>
<!-- Tab 6 結束	-->


    </div>
  </div>
<!-- partial -->
  <script src='js/jquery.min.js'></script>

   
</body>
</html>

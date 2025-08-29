<!DOCTYPE html>
<html lang="en" >
<head>
  <meta charset="UTF-8">
  <title>CodePen - foundation vertical tabs to menu bar</title>
  <meta name="viewport" content="width=device-width, initial-scale=1"><link rel='stylesheet' href='https://cdnjs.cloudflare.com/ajax/libs/foundation/6.3.0/css/foundation.min.css'><link rel="stylesheet" href="./style.css">

</head>
<body>
<?php
include "connect_link.php";//include connect_link.php到本程式；容易修改
$sql="SELECT * FROM f_selectmenu WHERE fsm_father='0' ORDER BY fsm_son_index ASC";//選擇f_selectmenu表格,的所有欄位
mysqli_set_charset($link,'utf8');//解決非utf亂碼
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result.
$number_result=mysqli_num_rows($result);//計算符合條件查尋結果的筆數
/** 把所有查尋到的結果存到$arr的array **/
for ( $i=0 ; $i<$number_result ; $i++ ) {
	$arr[$i]=mysqli_fetch_array($result);
	}
?>

<!-- partial:index.partial.html -->
<main class="row columns">
  
 
  
  <div class="row collapse">
    <div class="medium-3 columns">
      <div class="title-bar" data-responsive-toggle="example-vert-tabs" data-hide-for="medium">
        <button type="button" class="special-menu-button" data-toggle="example-vert-tabs"><span style="font-size:20px;">選擇項目</span></button>
      </div>
      <ul class="tabs vertical" id="example-vert-tabs" data-tabs>
      <?php
  
  		for($i=0; $i<1; $i++){
 	 ?>
        <li class="tabs-title is-active"><a href="#panel<?php echo $i+1 ?>v" aria-selected="true"><span style="font-size:20px;font-weight: bolder"><?php echo $arr[$i]['fsm_item']?></span></a></li>
        <?php
		}
		
		for($i=1; $i<$number_result; $i++){
		?>
        
        
		<li class="tabs-title"><a href="#panel<?php echo $i+1 ?>v"><span style="font-size:20px;font-weight: bolder"><?php echo $arr[$i]['fsm_item']?></span></a></li>

      <?php
		}
	  ?>
      </ul>
    </div>
    <div class="medium-9 columns">
      <div class="tabs-content vertical" data-tabs-content="example-vert-tabs">
       
        <div class="tabs-panel is-active" id="panel1v">
			<span style="font-weight: bolder"><?php echo $arr[0]['fsm_item']?></span>
          	<p><input type="radio" name="radio1">外送</input></p>
          	<p><input type="radio" name="radio1">外帶自取</input></p>
        </div>
        
        <div class="tabs-panel" id="panel2v">
			<span style="font-weight: bolder"><?php echo $arr[1]['fsm_item']?></span>
			<p>|<input type="radio" name="radio2">台中</input>|<input type="radio" name="radio2">台北</input>|<input type="radio" name="radio2">台南</input>|<input type="radio" name="radio2">台東</input>|</p>
        </div>
        
        <div class="tabs-panel" id="panel3v">
          	<span style="font-weight: bolder"><?php echo $arr[2]['fsm_item']?></span><br>
			|<a href="#" class="button1">八方雲集</a>|
			<img class="thumbnail" src="image/image1.jpg"><br>
			|<a href="#" class="button1">麥味登</a>|
			<img class="thumbnail" src="image/image2.jpg"><br>
			|<a href="#" class="button1">路易莎咖啡</a>|
			<img class="thumbnail" src="image/image3.jpg"><br>
        </div>
       
        <div class="tabs-panel" id="panel4v">
          <span style="font-weight: bolder"><?php echo $arr[3]['fsm_item']?></span><br>
          
          <?php
		  $item=$arr[3]['fsm_sn'];
          	$sql2="SELECT * FROM f_selectmenu WHERE fsm_father='$item' ORDER BY fsm_son_index ASC";//選擇f_selectmenu表格,的所有欄位
			$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result.
			$number_result2=mysqli_num_rows($result2);//計算符合條件查尋結果的筆數
			/** 把所有查尋到的結果存到$arr的array **/
			for ( $ii=0 ; $ii<$number_result2 ; $ii++ ) {
				$arr2[$ii]=mysqli_fetch_array($result2);
				}
				
				for ( $ii=0 ; $ii<$number_result2 ; $ii++ ) {
		  ?>
          
          
			|<a href="#" class="button1"><?php echo $arr2[$ii]['fsm_item'] ?></a>|
			
            <?php
				}
			?>
        </div>
        
        <div class="tabs-panel" id="panel5v">
         <span style="font-weight: bolder"><?php echo $arr[4]['fsm_item']?></span>
			<p>|<a href="#" class="button1">本日優惠方案</a>|</p>
			<p>|<a href="#" class="button1">嚴選餐廳</a>|</p>
			<p>|<a href="#" class="button1">買 1 送 1 優惠</a>|</p>
			<p>|<a href="#" class="button1">全國知名品牌</a>|</p>
			<p>|<a href="#" class="button1">您附近的餐廳</a>|</p>
			<p>|<a href="#" class="button1">生鮮雜貨，應有盡有</a>|</p>
			<p>|<a href="#" class="button1">健康餐點</a>|</p>
			<p>|<a href="#" class="button1">適合家庭享用的餐廳</a>|</p>
			<p>|<a href="#" class="button1">附近的熱門商家</a>|</p>
			<p>|<a href="#" class="button1">深受當地人喜愛</a>|</p>
			<p>|<a href="#" class="button1">好好款待自己</a>|</p>
			<p>|<a href="#" class="button1">過敏族群友善餐廳</a>|</p>
        </div>
       
        <div class="tabs-panel" id="panel6v">
          
			<img class="thumbnail" src="https://foundation.zurb.com/sites/docs/assets/img/generic/rectangle-5.jpg">
        </div>
      </div>
    </div>
  </div>

</main>
<!-- partial -->
  <script src='https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.1/jquery.min.js'></script>
<script src='https://cdnjs.cloudflare.com/ajax/libs/foundation/6.3.0/js/foundation.min.js'></script><script  src="./script.js"></script>

</body>
</html>

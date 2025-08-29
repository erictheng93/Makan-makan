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

/** 把所有查尋到的結果存到$arr的array --start--**/
for ( $i=0 ; $i<$number_result ; $i++ ) {
	$arr[$i]=mysqli_fetch_array($result);
	}
/** 把所有查尋到的結果存到$arr的array --end--**/
?>

<!-- partial:index.partial.html -->
<main class="row columns">

  <div class="row collapse">
  
   <!-- 呈現左邊menu  --start --> 
    <div class="medium-3 columns">
      <div class="title-bar" data-responsive-toggle="example-vert-tabs" data-hide-for="medium">
        <button type="button" class="special-menu-button" data-toggle="example-vert-tabs"><span style="font-size:20px;">選擇項目</span></button>
      </div>
      <ul class="tabs vertical" id="example-vert-tabs" data-tabs>
      <?php
  /** 呈現查尋結果menu的第一筆資料---start-- **/
  		for($i=0; $i<1; $i++){
 	 ?>
        <li class="tabs-title is-active"><a href="#panel<?php echo $i+1 ?>v" aria-selected="true"><span style="font-size:20px;font-weight: bolder"><?php echo $arr[$i]['fsm_item']?></span></a></li>
        <?php
		}
/** 呈現查尋結果menu的第一筆資料--end-- **/	
	
/** 呈現查尋結果menu的其他筆資料--start-- **/		
		for($i=1; $i<$number_result; $i++){
		?>
        
        
		<li class="tabs-title"><a href="#panel<?php echo $i+1 ?>v"><span style="font-size:20px;font-weight: bolder"><?php echo $arr[$i]['fsm_item']?></span></a></li>

      <?php
		}
/** 呈現查尋結果menu的其他筆資料--start-- **/	
	  ?>
      </ul>
    </div>
     <!-- 呈現左邊menu  --end -->
     
     <!-- 呈現右邊select item  --start --> 
    <div class="medium-9 columns">
      <div class="tabs-content vertical" data-tabs-content="example-vert-tabs">
       <?php 
	 /** 呈現查尋結果第一個menu的select筆資料--start-- **/	  
	   for($i=0; $i<1; $i++){
	   ?>
        <div class="tabs-panel is-active" id="panel<?php echo $i+1 ?>v">
			<span style="font-weight: bolder"><?php echo $arr[$i]['fsm_item']?></span>
            
            <?php
			/** 查尋結果第一個menu的select筆資料--start-- **/	 
            $item=$arr[$i]['fsm_sn'];
          	$sql2="SELECT * FROM f_selectmenu WHERE fsm_father='$item' ORDER BY fsm_son_index ASC";//選擇f_selectmenu表格,的所有欄位
			$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result.
			$number_result2=mysqli_num_rows($result2);//計算符合條件查尋結果的筆數
			/** 把所有查尋到的結果存到$arr的array **/
			for ( $ii=0 ; $ii<$number_result2 ; $ii++ ) {
				$arr2[$ii]=mysqli_fetch_array($result2);
				}
		/** 查尋結果第一個menu的select筆資料--end-- **/	 
			/** 呈現果第一個menu的select筆資料--start-- **/	
			for ( $ii=0 ; $ii<$number_result2 ; $ii++ ) {
			?>
          	<p><input type="radio" name="radio1"><?php echo $arr2[$ii]['fsm_item'] ?></input></p>
          	
            <?php
			}
			/** 呈現果第一個menu的select筆資料--end-- **/	
			?>
        </div>
        <?php
		/** 呈現查尋結果第一個menu的select筆資料--end-- **/
	   }
        
		?>
        
        
        <?php
		/** 呈現查尋結果其他menu的select筆資料--start-- **/
        for($i=1; $i<$number_result; $i++){
		
		?>
        
        
        <div class="tabs-panel" id="panel<?php echo $i+1 ?>v">
			<span style="font-weight: bolder"><?php echo $arr[$i]['fsm_item']?></span>
            
            <?php
            /** 查尋結果其他menu的select筆資料--start-- **/
			$item=$arr[$i]['fsm_sn'];
          	$sql2="SELECT * FROM f_selectmenu WHERE fsm_father='$item' ORDER BY fsm_son_index ASC";//選擇f_selectmenu表格,的所有欄位
			$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result.
			$number_result2=mysqli_num_rows($result2);//計算符合條件查尋結果的筆數
			/** 把所有查尋到的結果存到$arr的array **/
			for ( $ii=0 ; $ii<$number_result2 ; $ii++ ) {
				$arr2[$ii]=mysqli_fetch_array($result2);
				}
			/** 查尋結果其他menu的select筆資料--end-- **/
			?>
			<p>
            
            <?php
			/** 呈現果其他menu的select筆資料--start-- **/	
            for ( $ii=0 ; $ii<$number_result2 ; $ii++ ) {	
			?>
            |<input type="radio" name="radio2"><?php echo $arr2[$ii]['fsm_item'] ?></input>|
            <?php
			}
			/** 呈現果其他menu的select筆資料--end-- **/	
			?>
            </p>
        </div>
        <?php
		/** 呈現查尋結果其他menu的select筆資料--end-- **/
		}
		
		?>
        
      </div>
    </div>
    
    <!-- 呈現右邊select item  -end --> 
  </div>

</main>
<!-- partial -->
  <script src='https://cdnjs.cloudflare.com/ajax/libs/jquery/3.1.1/jquery.min.js'></script>
<script src='https://cdnjs.cloudflare.com/ajax/libs/foundation/6.3.0/js/foundation.min.js'></script><script  src="./script.js"></script>

</body>
</html>

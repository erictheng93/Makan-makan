<?php
$kedai=$_GET['k']; //get shop
$meja=$_GET["m"]; //get table
session_save_path('../session_data');
session_start();

require "../config.php";
mysqli_query($link, "SET CHARACTER SET UTF8");//解決亂碼
/* 選擇shop_info要顯示的物件 開始 */
$sql="SELECT * FROM shop_info WHERE shop_ID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
$result=mysqli_query($link,$sql);//執行指令,並把結果存到result
$number_result=mysqli_num_rows($result);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result; $i++){
$arr[$i]=mysqli_fetch_array($result);
}


/* 選擇Food主食 開始 */
$sql2="SELECT * FROM shop_menu WHERE shop_ID='$kedai' AND menu_available='1' ORDER BY menu_category, menu_subCategory ASC";//搜索資料指令
$result2=mysqli_query($link,$sql2);//執行指令,並把結果存到result
$number_result2=mysqli_num_rows($result2);//符合條件的查詢結果的筆數
/*  查詢結轉成果array             */
for($i=0; $i<$number_result2; $i++){
$arr2[$i]=mysqli_fetch_array($result2);
}
/* 選擇Food主食 結束 */


/* 選擇shop_info要顯示的物件 開始 */
$sql5="SELECT * FROM category";//搜索資料指令 捉取數據庫裡Banner的資料
$result5=mysqli_query($link,$sql5);//執行指令,並把結果存到result
$number_result5=mysqli_num_rows($result5);//符合條件的查詢結果的筆數
while($savedResult5 = mysqli_fetch_array($result5)) {
  	$OriginArrayName[] = $savedResult5[1];
	$OriginArrayID[] = $savedResult5[0];
}

$lenOriginArrayName=count($OriginArrayName);
$sql3="SELECT shop_category FROM shop_info WHERE shop_ID='$kedai'";//搜索資料指令 捉取數據庫裡Banner的資料
$result3=mysqli_query($link,$sql3);//執行指令,並把結果存到result
$number_result3=mysqli_num_rows($result3);//符合條件的查詢結果的筆數
while($savedResult3 = mysqli_fetch_array($result3)) {
  $ShopCat = $savedResult3[0];
}
$ShopArray= explode(',',$ShopCat);//Split a comma-delimited string into an array

$lenShopArray=count($ShopArray);
$tag=0;
$ii=-1;
$found="";
?>

<!doctype html>
<html>
    <head>
    <meta charset="utf-8">
    <!-- utf-8 works for most cases -->
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <!-- Forcing initial-scale shouldn't be necessary -->
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <!-- Use the latest (edge) version of IE rendering engine -->
    <title>點餐系統</title>
    <link href="https://fonts.googleapis.com/css?family=Open+Sans|Voces" rel="stylesheet">
		<link rel='stylesheet' href='https://maxcdn.bootstrapcdn.com/font-awesome/4.1.0/css/font-awesome.min.css'>
		<link rel="stylesheet" href="https://www.w3schools.com/w3css/4/w3.css">
	<link rel="stylesheet" href="./css/style.css">
  
<style type="text/css">
html,  body {
	margin: 0 !important;
	padding: 0 !important;
	/* height: 100% !important;*/
	width: 100% !important;
}
* {
	-ms-text-size-adjust: 100%;
	-webkit-text-size-adjust: 100%;
}
.ExternalClass {
	width: 100%;
}
div[style*="margin: 10px 0"] {
	margin: 0 !important;
}
table,  td {
	/* mso-table-lspace: 0pt !important;
	mso-table-rspace: 0pt !important; */
}
img {
	-ms-interpolation-mode: bicubic;
}
.yshortcuts a {
	border-bottom: none !important;
}
a[x-apple-data-detectors] {
	color: inherit !important;
}

</style>

    <!-- Progressive Enhancements -->
    <style type="text/css">
       
        /* What it does: Hover styles for buttons */
        .button-td,
        .button-a {
			position: absolute;
            transition: all 100ms ease-in;
			left: 60%;
			width: 100px;
			z-index: 3;	
        }
        .button-a:hover,
        .button-a:hover {
            background: #555555 !important;
            border-color: #555555 !important;
        }

        /* Media Queries */
        @media screen and (max-width: 600px) {

            .order-container {
               width: 100% !important;
            }

            /* What it does: Forces elements to resize to the full width of their container. Useful for resizing images beyond their max-width. */
            .fluid,
            .fluid-centered {
                max-width: 100% !important;
                height: auto !important;
                margin-left: auto !important;
                margin-right: auto !important;
            }
            /* And center justify these ones. */
            .fluid-centered {
                margin-left: auto !important;
                margin-right: auto !important;
            }

            /* What it does: Forces table cells into full-width rows. */
            .stack-column,
            .stack-column-center {
                display: block !important;
                width: 100% !important;
                max-width: 100% !important;
                direction: ltr !important;
            }
            /* And center justify these ones. */
            .stack-column-center {
                text-align: center !important;
            }
        
            /* What it does: Generic utility class for centering. Useful for images, buttons, and nested tables. */
            .center-on-narrow {
                text-align: center !important;
                display: block !important;
                margin-left: auto !important;
                margin-right: auto !important;
                float: none !important;
            }
            table.center-on-narrow {
                display: inline-block !important;
            }
			.button-a {
            transition: all 100ms ease-in;
			width: 100px;
			left: 20%;
			z-index: 3;	
        	}
                
        }

    </style>
    </head>
    <body bgcolor="#e0e0e0" width="100%" style="margin: 0;">
		<div class="w3-container">
    <table bgcolor="#e0e0e0" cellpadding="0" cellspacing="0" border="0" height="100%" width="100%" style="border-collapse:collapse;">
      <tr>
        <td><center style="width: 100%;">
			<!-- orderHeader : BEGIN -->
            <table align="center" width="100%" class="order-container">
            <tr>
                <td>
					<header class="header">
					<table width="100%" border="0"  >
					  <tbody>
						<tr>
						  <td width="22%"><img src="../image/logo.png" width="116" height="40" alt=""/></td>
						  <td width="55%">&nbsp;</td>
						  <td width="14%">&nbsp;</td>
						  <td width="9%" align="right"><button onclick="showPopup('a')"><img src="images/food-cart.png" width="30" height="30"/></button></td>
						</tr>
						<tr>
						  <td colspan="4">
						    
						      <input class="menu-btn" type="checkbox" id="menu-btn" />
						      <label class="menu-icon" for="menu-btn"><span class="navicon"></span></label>
						      <ul class="menu">
						        <li><a href="#work">|一般點餐|</a></li>
						        <li><a href="#about">|熱門點餐|</a></li>
						        <li><a href="#careers">|店家推薦|</a></li>
						        <li><a href="#contact">|最多好評|</a></li>
								<li><a href="#contact">|食客評議|</a></li>
								<li><a href="#contact">|聯絡我們|</a></li>
						       </ul>
						      
						    <!--<td colspan="2" align="right">|一般點餐|熱門點餐|店家推薦|最多好評|食客評議|聯絡我們|</td> -->					      </td>
					    </tr>
					  </tbody>
                	</table> 
					</header>                 
				</td>
             </tr>
          </table>
            <!-- order Header : END --> 
            <br>
			<br>
			<br>
			<br>
			<br>
			<br>
			<br>
            <!-- Email Body : BEGIN -->
			<!-- Hero Image, Flush : BEGIN -->
            <table cellspacing="0" cellpadding="0" border="0" align="center" bgcolor="#e0e0e0" width="100%" class="order-containers">
            <tr>
                <td class="full-width-image">
					<?php
					
					for($i=0; $i<$number_result2; $i++){
						//echo $arr2[$i]['menu_category'];
						//echo $found;
						$key = array_search($arr2[$i]['menu_category'], $ShopArray);
						if(strlen($key)>0 & $arr2[$i]['menu_category']<>$found){
							$tag=0;
									
						}
						
						if(strlen($key)>0 & $tag==0){
							echo "<center>" .$OriginArrayName[$arr2[$i]['menu_category']-1]."</center>";
							$tag=1;
							$found=$arr2[$i]['menu_category'];
							
						}
						
						
						
					?>
					<div class="projcard-container">		
						<div class="projcard projcard-blue">
							<div class="projcard-innerbox">
								<!-- when click on picture, go in food details -->
								<a href="fooddetails.php?foodserial=<?php echo $arr2[$i]['menu_sn']?>" target="iframe2" rel="modal:open" onclick="document.getElementById('id01').style.display='block'" class="w3-button w3-blue w3-margin-left w3-tiny">
								<!-- food images -->
								<img class="projcard-img" src="../login/edit/image/<?php echo $arr2[$i]['menu_pictures']?>"/>
								<!-- food images -->
								</a>
								<!-- when click on picture, go in food details -->
								<div class="projcard-textbox">
									<div class="projcard-title"><?php echo $arr2[$i]['menu_foodname']?></br>$<?php echo $arr2[$i]['menu_price']?><a href="order2.php?foodserial=<?php echo $arr2[$i]['menu_sn']?>" target="iframe2" rel="modal:open" onclick="document.getElementById('id01').style.display='block'" class="w3-button w3-blue w3-margin-left w3-tiny">選取</a></div>
<!--									<div class="projcard-subtitle"><?php //echo mb_substr($arr2[$i]['menu_describe'],0,12)?>..</div>	-->
								</div>
									
							</div>
						</div>
					</div>
					<?php
						}
					
					?>
				
																  
				</td>
              </tr>
			</table>
               <!-- Hero Image, Flush : END --> 
            <!-- Email Footer : BEGIN -->
            <table align="center" width="90%" class="email-container">
            <tr>
                <td style="padding: 40px 10px;width: 100%;font-size: 12px; so-height-rule: exactly; line-height:18px; text-align: center; color: #888888;">
					MakanMakan<br>
					<span class="mobile-link--footer">Asia University</span> <br>
					<unsubscribe style="color:#888888; text-decoration:underline;">Copyright © 亞洲大學 Asia University, Taiwan</unsubscribe>
				</td>
              </tr>
          </table>
            <!-- Email Footer : END -->
            
          </center></td>
      </tr>
    </table>

	<div id="id01" class="w3-modal" >
		<!--<div class="w3-modal-content">-->
		  <div class="w3-modal-content w3-card-4" style="max-width:80%;height:500px;margin-top: 40px">
			  <header class="w3-container w3-blue" > 
				<span onclick="document.getElementById('id01').style.display='none'" 
				class="w3-button w3-display-topright">&times;</span>
				&nbsp;&nbsp;&nbsp;
			  </header>
			  <div class="w3-container" tyle="height:450px">
				<iframe style="width:100%;height:450px"allowfullscreen name="iframe2" ></iframe>
			  </div>
			  
		</div>
  	</div>	
</div>		
		<!-- partial -->
  <script  src="./css/script.js"></script>
</body>
</html>

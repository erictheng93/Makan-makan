<?php
session_save_path('../session_data'); //把成功login之後的session存在session data裡面
session_start(); //Session開始
$kedai_nama=$_SESSION['shop_name'];
//echo $_SESSION['check'];
?>
<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>Makan Makan</title>
</head>
	
<style type="text/css">
 .drop-zone {
  max-width: 200px;
  height: 150px;
  padding: 25px;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-family: "Quicksand", sans-serif;
  font-weight: 500;
  font-size: 20px;
  cursor: pointer;
  color: #cccccc;
  border: 2px dashed #009578;
  border-radius: 10px;
}

.drop-zone--over {
  border-style: solid;
}

.drop-zone__input {
  display: none;
}

.drop-zone__thumb {
  width: 100%;
  height: 100%;
  border-radius: 10px;
  overflow: hidden;
  background-color: #cccccc;
  background-size: cover;
  position: relative;
}

.drop-zone__thumb::after {
  content: attr(data-label);
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  padding: 5px 0;
  color: #ffffff;
  background: rgba(0, 0, 0, 0.75);
  font-size: 14px;
  text-align: center;
}
 </style> 
<body>
	<?php echo $kedai_nama ?>食物新增
<form id="form1" name="form1" method="post" action="productAdd1-3.php" enctype="multipart/form-data">
  <table width="923" border="0" cellspacing="3" cellpadding="4">
    <tbody>
      <tr>
        <td width="102" bgcolor="#AECAD3">&nbsp;</td>
        <td width="261" bgcolor="#AECAD3">主類別</td>
        <td width="104" bgcolor="#AECAD3">次類別</td>
        <td width="409" bgcolor="#94B9C5">食物名稱</td>
      </tr>
      <tr>
        <td bgcolor="#94B9C5">食物類別</td>
        <td>
			<!--  start cascadate select menu                    -->    
			<select name=category id=category>
				<option value='' selected>Select</option>
					<?Php
					require "config2.php";// connection to database 
					$sql="SELECT  * from category "; // Query to collect data 

					foreach ($dbo->query($sql) as $row) {
					echo "<option value=$row[cat_id]>$row[category]</option>";
					}
					?>
			</select>
		</td>
        <td>
			<select name=sub-category id=sub-category>
			</select>
		</td>
        <td><input name="foodName" type="text" id="textfield" size="40"></td>
      </tr>
      <tr>
        <td valign="top" bgcolor="#94B9C5">食物簡介</td>
        <td ><textarea name="foodIntro" cols="40" rows="14" id="textarea"></textarea></td>
		<td valign="top" bgcolor="#94B9C5">圖片</td>
        <td>
<!---------照上上傳--------------->		   
		   	<div class="drop-zone">
    			<span class="drop-zone__prompt">Drop file here or click to upload</span>
    			<input type="file" name="myFile" class="drop-zone__input">
  			</div>
<!---------照上上傳--------------->			   	   
		</td>
      </tr>
	   <tr>
        
		<td height="56" bgcolor="#94B9C5">辣度</td>
        <td>
			<input name="nonspices" type="checkbox" id="checkbox4" checked="checked">
        		<label for="checkbox4">不辣 <br></label>
			<input type="checkbox" name="spices" id="checkbox5">
   		  		<label for="checkbox5">辣 :</label>
		  <input type="checkbox" name="spices1" id="checkbox6">
        		<label for="checkbox6">大辣 </label>
			<input type="checkbox" name="spices2" id="checkbox7">
        		<label for="checkbox7">中辣 </label>
			<input type="checkbox" name="spices3" id="checkbox8">
        		<label for="checkbox8">小辣 </label>
		</td>
		<td bgcolor="#94B9C5">葷/素</td>
        <td>
				<label for="checkbox9"> </label>
          	<input name="nonveg" type="checkbox" id="checkbox9" checked="checked">
          		<label for="checkbox9">葷 </label>
       	    <br>
       	    <input type="checkbox" name="wholeveg" id="checkbox10">
          		<label for="checkbox10">全素</label>
          	<input type="checkbox" name="eggveg" id="checkbox11">
          		<label for="checkbox11">蛋素</label>
       		<input type="checkbox" name="milkveg" id="checkbox12">
          		<label for="checkbox12">奶素</label>
          	<input type="checkbox" name="eggmilkveg" id="checkbox13">
        		<label for="checkbox13">蛋奶素</label>
		</td>
      </tr>
      <tr>
        <td bgcolor="#94B9C5">價格</td>
        <td>$
          	<input name="foodPrice1" type="text" id="textfield2" size="10">元
          	<input name="foodPrice2" type="text" id="textfield3" size="10">分
		</td>
        <td bgcolor="#94B9C5">外/內</td>
        <td>
			<input name="indoor" type="checkbox" id="checkbox1" checked="checked">
        		<label for="checkbox1">內用</label>
			<input type="checkbox" name="outdoor" id="checkbox2">
        		<label for="checkbox2">外帶</label>
		</td>
      </tr>
      <tr>
        <td height="32" bgcolor="#94B9C5">招牌菜</td>
        <td>
			<input type="checkbox" name="branded" id="checkbox3">
            	<label for="checkbox3">是</label>
		</td>
        <td align="left" bgcolor="#94B9C5">商品備註
		  </td>
        <td align="left" bgcolor="#94B9C5"><textarea name="remark" cols="30"></textarea></td>
      </tr>
	  <tr> 
        <td colspan="2" align="left" bgcolor="#4B8498">
			<input type="reset" name="reset" id="reset" value="重設"></td>
        <td colspan="2" align="right" bgcolor="#4B8498">
			<input type="submit" name="submit" id="submit" value="送出">
		</td>
      </tr>	
    </tbody>
	  
  </table>
</form>
<!--- ajax script    -->	
	<script  src="https://ajax.googleapis.com/ajax/libs/jquery/3.5.1/jquery.min.js"></script>
	<script>
	$(document).ready(function() {
	////////////
	$('#category').change(function(){
	//var st=$('#category option:selected').text();
	var cat_id=$('#category').val();
	$('#sub-category').empty(); //remove all existing options
	///////
	$.get('ddck.php',{'cat_id':cat_id},function(return_data){
	$.each(return_data.data, function(key,value){
			$("#sub-category").append("<option value=" + value.subcat_id +">"+value.subcategory+"</option>");
		});
	}, "json");
	///////
	});
	/////////////////////
	});
	</script>
	
<script>
  document.querySelectorAll(".drop-zone__input").forEach((inputElement) => {
  const dropZoneElement = inputElement.closest(".drop-zone");

  dropZoneElement.addEventListener("click", (e) => {
    inputElement.click();
  });

  inputElement.addEventListener("change", (e) => {
    if (inputElement.files.length) {
      updateThumbnail(dropZoneElement, inputElement.files[0]);
    }
  });

  dropZoneElement.addEventListener("dragover", (e) => {
    e.preventDefault();
    dropZoneElement.classList.add("drop-zone--over");
  });

  ["dragleave", "dragend"].forEach((type) => {
    dropZoneElement.addEventListener(type, (e) => {
      dropZoneElement.classList.remove("drop-zone--over");
    });
  });

  dropZoneElement.addEventListener("drop", (e) => {
    e.preventDefault();

    if (e.dataTransfer.files.length) {
      inputElement.files = e.dataTransfer.files;
      updateThumbnail(dropZoneElement, e.dataTransfer.files[0]);
    }

    dropZoneElement.classList.remove("drop-zone--over");
  });
});

/**
 * Updates the thumbnail on a drop zone element.
 *
 * @param {HTMLElement} dropZoneElement
 * @param {File} file
 */
function updateThumbnail(dropZoneElement, file) {
  let thumbnailElement = dropZoneElement.querySelector(".drop-zone__thumb");

  // First time - remove the prompt
  if (dropZoneElement.querySelector(".drop-zone__prompt")) {
    dropZoneElement.querySelector(".drop-zone__prompt").remove();
  }

  // First time - there is no thumbnail element, so lets create it
  if (!thumbnailElement) {
    thumbnailElement = document.createElement("div");
    thumbnailElement.classList.add("drop-zone__thumb");
    dropZoneElement.appendChild(thumbnailElement);
  }

  thumbnailElement.dataset.label = file.name;

  // Show thumbnail for image files
  if (file.type.startsWith("image/")) {
    const reader = new FileReader();

    reader.readAsDataURL(file);
    reader.onload = () => {
      thumbnailElement.style.backgroundImage = `url('${reader.result}')`;
    };
  } else {
    thumbnailElement.style.backgroundImage = null;
  }
}
 
 function mydate() {
  //alert("");
  document.getElementById("dt").hidden = false;
  document.getElementById("ndt").hidden = true;
}

function mydate1() {
  d = new Date(document.getElementById("dt").value);
  dt = d.getDate();
 
  mn = d.getMonth();
   
  mn++;
  yy = d.getFullYear();
  if (mn < 10) { mn = '0' + mn; }
  if (dt < 10) { dt = '0' + dt; }
  document.getElementById("ndt").value = yy + "-" + mn + "-" + dt
  document.getElementById("ndt").hidden = false;
  document.getElementById("dt").hidden = true;
} 
  </script>
</body>
</html>

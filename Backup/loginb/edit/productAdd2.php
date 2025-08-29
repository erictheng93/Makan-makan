<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>無標題文件</title>
</head>

<body>
	食物新增
<form id="form1" name="form1" method="post" action="savedata.php">
  <table width="926" border="0" cellspacing="3" cellpadding="4">
    <tbody>
      <tr>
        <td width="119">&nbsp;</td>
        <td width="288" bgcolor="#AECAD3">主類別</td>
        <td width="178" bgcolor="#AECAD3">次類別</td>
        <td width="294" bgcolor="#94B9C5">食物名稱</td>
      </tr>
      <tr>
        <td bgcolor="#94B9C5">食物類別</td>
        <td>
			<!--  start cascade select menu                    -->    
			<select name=category id=category>
				<option value='' selected>Select</option>
					<?Php
					require "config.php";// connection to database 
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
			<!--  end cascade select menu                    --> 
		</td>
        <td><input name="textfield" type="text" id="textfield" size="40"></td>
      </tr>
      <tr>
        <td bgcolor="#94B9C5">食物簡介</td>
        <td colspan="3"><textarea name="textarea" cols="100" rows="8" id="textarea"></textarea></td>
      </tr>
	   <tr>
        <td bgcolor="#94B9C5">圖片</td>
        <td colspan="3">&nbsp;</td>
      </tr>
      <tr>
        <td bgcolor="#94B9C5">價格</td>
        <td>$
          	<input name="textfield2" type="text" id="textfield2" size="10">元
          	<input name="textfield3" type="text" id="textfield3" size="10">角
		  </td>
        <td bgcolor="#94B9C5">外/內</td>
        <td>
			<input name="checkbox1" type="checkbox" id="checkbox1" checked="checked">
        		<label for="checkbox1">內用</label>
			<input type="checkbox" name="checkbox2" id="checkbox2">
        		<label for="checkbox2">外帶</label>
		</td>
      </tr>
      <tr>
        <td bgcolor="#94B9C5">招牌菜</td>
        <td>
			<input type="checkbox" name="checkbox3" id="checkbox3">
       	  <label for="checkbox3">是 </label>
		</td>
        <td bgcolor="#94B9C5">辣度</td>
        <td>
			<input name="checkbox4" type="checkbox" id="checkbox4" checked="checked">
        		<label for="checkbox4">不辣 </label>
			<input type="checkbox" name="checkbox5" id="checkbox5">
   		  <label for="checkbox5">辣 </label>
			<input type="checkbox" name="checkbox6" id="checkbox6">
        		<label for="checkbox6">大辣 </label>
			<input type="checkbox" name="checkbox7" id="checkbox7">
        		<label for="checkbox7">中辣 </label>
			<input type="checkbox" name="checkbox8" id="checkbox8">
        		<label for="checkbox8">小辣 </label>
		</td>
      </tr>
      <tr>
        <td height="53" bgcolor="#94B9C5">葷/素</td>
        <td>
			<input name="checkbox9" type="checkbox" id="checkbox9" checked="checked">
   		  <label for="checkbox9">葷 </label>
          	<input type="checkbox" name="checkbox10" id="checkbox10">
          		<label for="checkbox10">全素</label>
			<input type="checkbox" name="checkbox11" id="checkbox11">
        		<label for="checkbox11">蛋素</label>
          	<input type="checkbox" name="checkbox12" id="checkbox12">
        		<label for="checkbox12">奶素</label>
		  <input type="checkbox" name="checkbox13" id="checkbox13">
   		  <label for="checkbox13">蛋奶素</label>
	    </td>
        <td bgcolor="#4B8498"><input type="reset" name="reset" id="reset" value="重設"></td>
        <td align="right" bgcolor="#4B8498"><input type="submit" name="submit" id="submit" value="送出"></td>
      </tr>
    </tbody>
  </table>
</form>
<!--- ajax script    -->	
	<script  src="./jquery.min.js"></script>
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
</body>
</html>

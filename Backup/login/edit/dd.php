<html>
<head>
<title>plus2net demo scripts using JQuery</title>
</head>

<body>

<form method=post action=dd-submit.php>
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
<select name=sub-category id=sub-category>
</select>
<input type=submit value=Submit></form>
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
</body>
</html>

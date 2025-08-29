<?Php
@$cat_id=$_GET['cat_id'];
//$cat_id=2;
/// Preventing injection attack //// 
if(!is_numeric($cat_id)){
echo "Data Error";
exit;
 }
/// end of checking injection attack ////
require "config2.php"; // Database connection string 

$sql="SELECT subcategory,subcat_id FROM subcategory WHERE cat_id=:cat_id";
$row=$dbo->prepare($sql);
$row->bindParam(':cat_id',$cat_id,PDO::PARAM_INT,5);
$row->execute();
$result=$row->fetchAll(PDO::FETCH_ASSOC);

$main = array('data'=>$result);
echo json_encode($main);
?>

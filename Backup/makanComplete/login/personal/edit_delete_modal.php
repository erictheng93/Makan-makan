<!-- Edit -->
<?php 
$emp_status=array("admin","店主","廚師","送菜員","收銀員"); //先給這個emp_status一個一維陣列
$arrLength = count($emp_status); //計算這個array長度
?>
<div class="modal fade" id="edit_<?php echo $row['sol_sn']; ?>" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <center><h4 class="modal-title" id="myModalLabel">Edit Member</h4></center>
            </div>
            <div class="modal-body">
			<div class="container-fluid">
			<form method="POST" action="edit.php">
				<input type="hidden" class="form-control" name="id" value="<?php echo $row['sol_sn']; ?>">
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">名稱:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="firstname" value="<?php echo $row['sol_name']; ?>">
					</div>
				</div>
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">職稱:</label>
					</div>
					<div class="col-sm-10">					  
                        <select name="empStatus" id="select" class="form-control" >
							<?php 
							for($i=1;$i<$arrLength;$i++){
								if((int)$row['sol_status']==$i){
									$selected="selected";
								}else{
									$selected="";
								}
							?>
                          <option value="<?php echo $i?>" <?php echo $selected ?>><?php echo $emp_status[$i]?></option>
							<?php
								}
							?>
                        </select>
                    </div>
				</div>
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">地址:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="address" value="<?php echo $row['sol_adrress']; ?>">
					</div>
				</div>
				<div class="row form-group">
					<div class="col-sm-2">
						<label class="control-label modal-label">手機:</label>
					</div>
					<div class="col-sm-10">
						<input type="text" class="form-control" name="empMP" value="<?php echo $row['sol_hp']; ?>">
					</div>
				</div>
            </div> 
			</div>
            <div class="modal-footer">
				<!-- 取消按鈕 -->
                <button type="button" class="btn btn-default" data-dismiss="modal"><span class="glyphicon glyphicon-remove"></span> Cancel</button>
				<!-- 修改按鈕 -->
                <button type="submit" name="edit" class="btn btn-success"><span class="glyphicon glyphicon-check"></span> Update</a>
			</form>
            </div>

        </div>
    </div>
</div>

<!-- Delete -->
<div class="modal fade" id="delete_<?php echo $row['sol_sn']; ?>" tabindex="-1" role="dialog" aria-labelledby="myModalLabel" aria-hidden="true">
    <div class="modal-dialog">
        <div class="modal-content">
            <div class="modal-header">
                <button type="button" class="close" data-dismiss="modal" aria-hidden="true">&times;</button>
                <center><h4 class="modal-title" id="myModalLabel">職員資料刪除</h4></center>
            </div>
            <div class="modal-body">	
            	<p class="text-center">確定刪除嗎??</p>
				<h2 class="text-center"><?php echo $row['sol_name'].' '.$row['sol_status']; ?></h2>
			</div>
            <div class="modal-footer">
                <button type="button" class="btn btn-default" data-dismiss="modal"><span class="glyphicon glyphicon-remove"></span> Cancel</button>
                <a href="delete.php?id=<?php echo $row['sol_sn']; ?>" class="btn btn-danger"><span class="glyphicon glyphicon-trash"></span> Yes</a>
            </div>

        </div>
    </div>
</div>
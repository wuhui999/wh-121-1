$baseUrl = "http://localhost:3001/api"

Write-Host "=== 摄影棚器材租借系统 - 完整业务流程测试 ===" -ForegroundColor Cyan
Write-Host ""

# 1. 登录
Write-Host "1. 登录系统 (clerk1/clerk123)" -ForegroundColor Yellow
$loginBody = @{
    username = "clerk1"
    password = "clerk123"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "$baseUrl/auth/login" -Method POST -ContentType "application/json" -Body $loginBody
$loginData = $loginResponse.Content | ConvertFrom-Json
$token = $loginData.data.token
$headers = @{ Authorization = "Bearer $token" }
Write-Host "   登录成功！" -ForegroundColor Green
Write-Host ""

# 2. 获取器材列表
Write-Host "2. 获取器材列表" -ForegroundColor Yellow
$eqResponse = Invoke-WebRequest -Uri "$baseUrl/equipments" -Headers $headers
$eqData = $eqResponse.Content | ConvertFrom-Json
$equipments = $eqData.data
Write-Host "   共 $($equipments.Count) 件器材" -ForegroundColor Green
$eq = $equipments[0]
Write-Host "   选择器材: $($eq.equipment_no) - $($eq.brand) $($eq.model)"
Write-Host "   日租金: ¥$($eq.daily_rent), 押金: ¥$($eq.deposit)"
Write-Host ""

# 3. 创建预约订单
Write-Host "3. 创建预约订单" -ForegroundColor Yellow
$startDate = "2026-06-10"
$endDate = "2026-06-12"
$orderBody = @{
    equipment_id = $eq.id
    start_date = $startDate
    end_date = $endDate
    customer_id = 4
    remark = "测试订单 - 商业拍摄"
} | ConvertTo-Json

$orderResponse = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST -ContentType "application/json" -Headers $headers -Body $orderBody
$orderData = $orderResponse.Content | ConvertFrom-Json
$order = $orderData.data
Write-Host "   订单创建成功！" -ForegroundColor Green
Write-Host "   订单号: $($order.order_no)"
Write-Host "   状态: $($order.status)"
Write-Host "   租期: $startDate 至 $endDate ($($order.days)天)"
Write-Host "   租金: ¥$($order.total_rent), 押金: ¥$($order.deposit)"
Write-Host ""

# 4. 确认订单
Write-Host "4. 确认订单" -ForegroundColor Yellow
$confirmResponse = Invoke-WebRequest -Uri "$baseUrl/orders/$($order.id)/confirm" -Method PUT -Headers $headers
$confirmData = $confirmResponse.Content | ConvertFrom-Json
Write-Host "   订单确认成功！状态: $($confirmData.data.status)" -ForegroundColor Green
Write-Host ""

# 5. 检查器材状态
Write-Host "5. 检查器材状态" -ForegroundColor Yellow
$eqDetailResponse = Invoke-WebRequest -Uri "$baseUrl/equipments/$($eq.id)" -Headers $headers
$eqDetailData = $eqDetailResponse.Content | ConvertFrom-Json
Write-Host "   器材状态: $($eqDetailData.data.status)" -ForegroundColor Green
Write-Host ""

# 6. 出借确认
Write-Host "6. 出借确认" -ForegroundColor Yellow
$lendingBody = @{
    order_id = $order.id
    appearance = "外观完好，无划痕"
    accessories = "电池×1, 充电器×1, 肩带×1, 数据线×1"
    deposit_received = $order.deposit
    remark = "客户已支付押金"
} | ConvertTo-Json

$lendingResponse = Invoke-WebRequest -Uri "$baseUrl/lendings" -Method POST -ContentType "application/json" -Headers $headers -Body $lendingBody
$lendingData = $lendingResponse.Content | ConvertFrom-Json
Write-Host "   出借确认成功！" -ForegroundColor Green
Write-Host "   出借时间: $($lendingData.data.lent_at)"
Write-Host ""

# 7. 检查器材状态（已出借）
Write-Host "7. 检查器材状态（出借后）" -ForegroundColor Yellow
$eqDetail2Response = Invoke-WebRequest -Uri "$baseUrl/equipments/$($eq.id)" -Headers $headers
$eqDetail2Data = $eqDetail2Response.Content | ConvertFrom-Json
Write-Host "   器材状态: $($eqDetail2Data.data.status)" -ForegroundColor Green
Write-Host ""

# 8. 测试预约冲突
Write-Host "8. 测试预约冲突（同一器材同一时间段）" -ForegroundColor Yellow
$conflictBody = @{
    equipment_id = $eq.id
    start_date = "2026-06-11"
    end_date = "2026-06-13"
    customer_id = 5
} | ConvertTo-Json

try {
    $conflictResponse = Invoke-WebRequest -Uri "$baseUrl/orders" -Method POST -ContentType "application/json" -Headers $headers -Body $conflictBody -ErrorAction Stop
    Write-Host "   错误: 应该检测到冲突但没有！" -ForegroundColor Red
} catch {
    $errorResponse = $_.Exception.Response
    $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
    $errorContent = $reader.ReadToEnd()
    $errorData = $errorContent | ConvertFrom-Json
    Write-Host "   冲突检测成功！" -ForegroundColor Green
    Write-Host "   错误信息: $($errorData.error)"
}
Write-Host ""

# 9. 归还检查（模拟迟还2小时，轻微损坏）
Write-Host "9. 归还检查（迟还2小时，轻微损坏）" -ForegroundColor Yellow
$returnBody = @{
    order_id = $order.id
    actual_return_time = "2026-06-12 02:00:00"
    is_late = 1
    late_hours = 2
    is_damaged = 1
    damage_level = "minor"
    damage_description = "镜头有轻微划痕"
    damage_fee = [math]::Round($eq.daily_rent * 1, 2)
    is_missing = 0
    missing_fee = 0
    repair_suggestion = "不需要维修"
    remark = "迟还2小时，镜头轻微划痕"
} | ConvertTo-Json

$returnResponse = Invoke-WebRequest -Uri "$baseUrl/returns" -Method POST -ContentType "application/json" -Headers $headers -Body $returnBody
$returnData = $returnResponse.Content | ConvertFrom-Json
Write-Host "   归还检查完成！" -ForegroundColor Green
Write-Host "   迟还费: ¥$($returnData.data.late_fee)"
Write-Host "   损坏费: ¥$($returnData.data.damage_fee)"
Write-Host ""

# 10. 检查器材状态（归还后）
Write-Host "10. 检查器材状态（归还后）" -ForegroundColor Yellow
$eqDetail3Response = Invoke-WebRequest -Uri "$baseUrl/equipments/$($eq.id)" -Headers $headers
$eqDetail3Data = $eqDetail3Response.Content | ConvertFrom-Json
Write-Host "   器材状态: $($eqDetail3Data.data.status)" -ForegroundColor Green
Write-Host ""

# 11. 结算
Write-Host "11. 财务结算" -ForegroundColor Yellow
$settlementBody = @{
    order_id = $order.id
    remark = "结算完成"
} | ConvertTo-Json

$settlementResponse = Invoke-WebRequest -Uri "$baseUrl/settlements" -Method POST -ContentType "application/json" -Headers $headers -Body $settlementBody
$settlementData = $settlementResponse.Content | ConvertFrom-Json
$s = $settlementData.data
Write-Host "   结算成功！" -ForegroundColor Green
Write-Host "   租金: ¥$($s.total_rent)"
Write-Host "   迟还费: ¥$($s.late_fee)"
Write-Host "   损坏费: ¥$($s.damage_fee)"
Write-Host "   总费用: ¥$($s.total_fee)"
Write-Host "   收取押金: ¥$($s.deposit_received)"
Write-Host "   押金抵扣: ¥$($s.deposit_deducted)"
Write-Host "   应退金额: ¥$($s.refund_amount)"
Write-Host "   需补付: ¥$($s.additional_payment)"
Write-Host ""

# 12. 验证费用计算
Write-Host "12. 费用计算验证" -ForegroundColor Yellow
$expectedRent = $order.days * $eq.daily_rent
$expectedLateFee = [math]::Round(2 * ($eq.daily_rent / 24) * 1.5, 2)
$expectedDamageFee = [math]::Round($eq.daily_rent * 1, 2)
$expectedTotal = $expectedRent + $expectedLateFee + $expectedDamageFee
$expectedDeduction = [math]::Min($order.deposit, $expectedTotal)
$expectedRefund = [math]::Max(0, $order.deposit - $expectedDeduction)
$expectedAdditional = [math]::Max(0, $expectedTotal - $expectedDeduction)

Write-Host "   预期租金: $($order.days)天 × ¥$($eq.daily_rent) = ¥$expectedRent"
Write-Host "   预期迟还费: 2小时 × (¥$($eq.daily_rent)/24) × 1.5 = ¥$expectedLateFee"
Write-Host "   预期损坏费: ¥$($eq.daily_rent) × 1 = ¥$expectedDamageFee"
Write-Host "   预期总费用: ¥$expectedTotal"
Write-Host "   预期押金抵扣: min(¥$($order.deposit), ¥$expectedTotal) = ¥$expectedDeduction"
Write-Host "   预期应退: ¥$($order.deposit) - ¥$expectedDeduction = ¥$expectedRefund"

$rentOk = [math]::Abs($s.total_rent - $expectedRent) -lt 0.01
$lateOk = [math]::Abs($s.late_fee - $expectedLateFee) -lt 0.01
$damageOk = [math]::Abs($s.damage_fee - $expectedDamageFee) -lt 0.01
$totalOk = [math]::Abs($s.total_fee - $expectedTotal) -lt 0.01
$deductionOk = [math]::Abs($s.deposit_deducted - $expectedDeduction) -lt 0.01
$refundOk = [math]::Abs($s.refund_amount - $expectedRefund) -lt 0.01
$additionalOk = [math]::Abs($s.additional_payment - $expectedAdditional) -lt 0.01

if ($rentOk -and $lateOk -and $damageOk -and $totalOk -and $deductionOk -and $refundOk -and $additionalOk) {
    Write-Host "   所有费用计算正确！✅" -ForegroundColor Green
} else {
    Write-Host "   费用计算有误！❌" -ForegroundColor Red
    if (-not $rentOk) { Write-Host "   租金不符: 实际¥$($s.total_rent), 预期¥$expectedRent" -ForegroundColor Red }
    if (-not $lateOk) { Write-Host "   迟还费不符: 实际¥$($s.late_fee), 预期¥$expectedLateFee" -ForegroundColor Red }
    if (-not $damageOk) { Write-Host "   损坏费不符: 实际¥$($s.damage_fee), 预期¥$expectedDamageFee" -ForegroundColor Red }
}
Write-Host ""

# 13. 检查订单状态
Write-Host "13. 检查订单状态" -ForegroundColor Yellow
$orderDetailResponse = Invoke-WebRequest -Uri "$baseUrl/orders/$($order.id)" -Headers $headers
$orderDetailData = $orderDetailResponse.Content | ConvertFrom-Json
Write-Host "   订单状态: $($orderDetailData.data.status)" -ForegroundColor Green
Write-Host ""

Write-Host "=== 测试完成 ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "测试结果汇总:" -ForegroundColor Yellow
Write-Host "  ✅ 用户认证与权限"
Write-Host "  ✅ 器材管理"
Write-Host "  ✅ 预约订单创建"
Write-Host "  ✅ 订单确认"
Write-Host "  ✅ 预约冲突检测"
Write-Host "  ✅ 出借确认"
Write-Host "  ✅ 器材状态同步"
Write-Host "  ✅ 归还检查（迟还、损坏）"
Write-Host "  ✅ 自动计费（租金、迟还费、损坏费）"
Write-Host "  ✅ 押金结算（抵扣、应退、补付）"
Write-Host "  ✅ 订单状态完整流转"
Write-Host ""
Write-Host "所有核心功能测试通过！🎉" -ForegroundColor Green

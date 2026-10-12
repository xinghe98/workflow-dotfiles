-- 固定顶栏缩放，并为终端网格增加横向 8 px、纵向 10 px 的留白。
tern.css("spacing", [[
#tabbar {
    zoom: 1 !important;
}

#panel {
    top: 37px !important;
}

.csd-ctl {
    top: 6px !important;
}

.tn-pane > .tn-body > .tv {
    margin: 10px 8px;
}
]])

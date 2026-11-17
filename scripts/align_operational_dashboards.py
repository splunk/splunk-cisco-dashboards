"""Keep generated operational canvases aligned with the shared story-card layout."""
from copy import deepcopy


def block(item, x, y, w, h, kind='block'):
    return {'item': item, 'type': kind, 'position': dict(x=x, y=y, w=w, h=h)}


def text(value, size=15, color='#a6adb6'):
    return {'type': 'splunk.markdown', 'title': '', 'showLastUpdated': False,
            'showProgressBar': False, 'options': {'backgroundColor': 'transparent',
            'fontColor': color, 'fontSize': 'custom', 'customFontSize': size, 'markdown': value}}


def align(definition, reference, name, notes=None):
    v = definition['visualizations']
    pages = definition['layout']['layoutDefinitions']
    page = next(iter(pages.values()))
    page['options'].pop('backgroundImage', None)
    page['options'].update(width=1920, backgroundColor='#0f1117')
    if name == 'sn_agentic_ops_operational_intelligence':
        definition['layout']['layoutDefinitions'] = {'layout_overview': page}
        definition['layout']['tabs'] = {
            'items': [{'label': 'Overview', 'layoutId': 'layout_overview'}],
            'options': {'showTabBar': False}}
        for key in list(v):
            if key.startswith('viz_library_'):
                del v[key]
        return
    for key in ['viz_header_bg', 'viz_header_icon']:
        if key not in v:
            v[key] = deepcopy(reference['visualizations'][key])
    if name == 'dc_networking_operations':
        v['viz_header'] = v.pop('header')
        heading, scope = v['viz_header']['options']['markdown'].split('\n\n', 1)
        v['viz_header']['options'].update(markdown=heading, backgroundColor='transparent')
        v['viz_scope'] = text(scope)
        v['viz_header_icon']['title'] = definition['title']
    structure = [block('viz_header_bg',20,0,1880,96),block('viz_header_icon',38,16,64,64),
                 block('viz_header',118,8,1290,80),block('input_time_range',1440,8,370,80,'input'),
                 block('viz_scope',36,108,1848,64)]
    background = reference['visualizations']['viz_card_fabric_health_background']
    if name == 'dc_networking_operations':
        keys = [key for key in v if key.startswith('viz_') and v[key]['type'] in ('splunk.area','splunk.line','splunk.bar','splunk.column')]
        for i, key in enumerate(keys):
            x,y = 20+(i%3)*633,188+(i//3)*456
            prefix = 'card_'+key
            title = v[key]['title']
            v[prefix+'_background'] = deepcopy(background)
            v[prefix+'_title'] = text('**'+title+'**',20,'#ecf0f5')
            note = (notes or {}).get(key, 'Observed measurements in the selected scope and time range. Missing data stays unknown.')
            v[prefix+'_description'] = text(note)
            v[key].update(title='', description='', showLastUpdated=False, showProgressBar=False)
            v[key]['options']['backgroundColor'] = 'transparent'
            detail = 'detail_'+key[4:]
            v[detail]['options']['iconStyle'] = 'panel'
            search = 'search_'+key[4:]
            v[search] = {'type': 'splunk.cisco_drilldown_action', 'options': {
                'action': 'open-search', 'targetVisualization': key, 'label': 'Open '+title+' in Search'}}
            structure += [block(prefix+'_background',x,y,613,440),block(prefix+'_title',x+16,y+12,482,64),
                          block(prefix+'_description',x+16,y+80,581,84),block(key,x+16,y+172,581,252),
                          block('detail_'+key[4:],x+558,y+6,42,42),block(search,x+514,y+6,42,42)]
        bottom = 188+((len(keys)+2)//3)*456
        structure.append(block('notes',36,bottom,1848,180))
        v['notes']['options']['backgroundColor'] = 'transparent'
        page['options']['height'] = bottom+200
    else:
        for i in range(6):
            prefix = f'viz_evidence_{i+1}'
            x,y = 20+(i%3)*633,188+(i//3)*456
            v[prefix+'_background'] = deepcopy(background)
            title = v[prefix+'_title']['options']['markdown'].removeprefix('### ')
            v[prefix+'_title'] = text('**'+title+'**',20,'#ecf0f5')
            v[prefix+'_description']['options']['customFontSize'] = 15
            structure += [block(prefix+'_background',x,y,613,440),block(prefix+'_title',x+16,y+12,482,64),
                          block(prefix+'_description',x+16,y+80,581,64),block(prefix+'_table',x+16,y+152,581,272),
                          block(prefix+'_info',x+514,y+6,42,42),block(prefix+'_action',x+558,y+6,42,42)]
        structure += [block('viz_interface_text',36,1120,1730,114),block('viz_interface_action',1828,1136,56,56)]
        page['options']['height'] = 1250
    page['structure'] = structure

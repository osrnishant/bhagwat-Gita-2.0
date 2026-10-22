import asyncio
from concurrent.futures import ThreadPoolExecutor
import importlib.util
from pathlib import Path
import sys
import tempfile
import types
import unittest

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from app.usage import reserve


def pipeline():
    # Provider and optional dependency doubles: these tests make no API calls.
    class APIError(Exception): pass
    class Cache(dict):
        def __init__(self,**_): super().__init__()
    def response(**values): return types.SimpleNamespace(**values)
    replacements={
      'anthropic':types.SimpleNamespace(APIError=APIError),
      'cachetools':types.SimpleNamespace(TTLCache=Cache),
      'app.embedding':types.SimpleNamespace(encode=lambda _:[]),
      'app.retriever':types.SimpleNamespace(search=None),
      'app.prompts':types.SimpleNamespace(build_system_prompt=lambda _:''),
      'app.claude_client':types.SimpleNamespace(generate=None,generate_stream=None),
      'app.metrics':types.SimpleNamespace(record_cache_hit=lambda:None),
      'app.tts_client':types.SimpleNamespace(synthesize=None),
      'app.models':types.SimpleNamespace(AskRequest=object,AskResponse=response,VerseResult=response),
    }
    previous={key:sys.modules.get(key) for key in replacements}
    sys.modules.update(replacements)
    try:
        spec=importlib.util.spec_from_file_location('app.security_test_pipeline',ROOT/'app/pipeline.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module);return module
    finally:
        for key,value in previous.items():
            if value is None:sys.modules.pop(key,None)
            else:sys.modules[key]=value


class SecurityTests(unittest.TestCase):
    def test_budget_is_atomic_across_concurrent_workers_and_persists(self):
        with tempfile.TemporaryDirectory() as directory:
            path=Path(directory)/'usage.sqlite3'
            with ThreadPoolExecutor(max_workers=8) as pool:
                outcomes=list(pool.map(lambda _:reserve(path,5),range(20)))
            self.assertEqual(sum(outcomes),5)
            self.assertFalse(reserve(path,5))

    def test_empty_and_invented_citations_fail(self):
        mod=pipeline();verses=[{'id':'1_1'}]
        self.assertFalse(mod.validate_citations('No sources',verses))
        self.assertFalse(mod.validate_citations('CITED: [9:9]',verses))
        self.assertTrue(mod.validate_citations('CITED: [1:1]',verses))

    def test_stream_never_publishes_unvalidated_model_text(self):
        mod=pipeline()
        async def search(*_):return [{'id':'1_1','chapter':1,'verse':1,'sanskrit':'s','hindi':'h','english':'e'}],[.9],False
        async def generate(*_,**__):return 'UNSUPPORTED_SECRET_TEST CITED: [9:9]'
        mod.search=search;mod.generate=generate
        request=types.SimpleNamespace(history=[],question='Explain responsibility',top_k=1,language='en')
        async def collect():return ''.join([chunk async for chunk in mod.stream_krishna(request)])
        output=asyncio.run(collect())
        self.assertIn('event: error',output)
        self.assertNotIn('UNSUPPORTED_SECRET_TEST',output)
        self.assertNotIn('[DONE]',output)

if __name__=='__main__':unittest.main()
